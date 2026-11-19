import Enquiry from '../models/Enquiry.js';
import EnquiryRoute from '../models/EnquiryRoute.js';
import Job, { openJobsFilter } from '../models/Job.js';
import { validateEnquiry } from '../utils/validators.js';
import { HttpError } from '../utils/httpError.js';
import { oneLine } from '../utils/strings.js';
import { resolveRecipients } from './routing.js';
import { sendMail } from './mailer.js';
import { sendThankYou } from './thankYou.js';

const FORM_LABEL = {
  pos: 'Salon POS registration',
  product: 'Product enquiry',
  contact: 'Website contact',
  career: 'Career application',
  service: 'Service enquiry',
};

const DETAIL_LABEL = {
  businessName: 'Salon / business',
  city: 'City',
  branches: 'Branches',
  interest: 'Interested in',
  enquiryType: 'Enquiry type',
  serviceName: 'Service',
  dob: 'Date of birth',
  role: 'Applying for',
  experience: 'Experience',
  qualification: 'Highest qualification',
  lastRole: 'Current or last role',
  availableFrom: 'Available from',
};

const NO_RECIPIENTS_MESSAGE =
  'No email address is set for this kind of enquiry. Add one under Email routing in the admin panel.';
const TEST_MODE_MESSAGE =
  'Not sent: the website is in test mode (MAIL_DRY_RUN=1 in the backend .env file). Set it to 0 to send real emails.';

function subjectFor(lead) {
  const d = lead.details;
  switch (lead.form) {
    case 'pos':
      return oneLine(`Salon POS registration: ${d.businessName} (${d.city})`);
    case 'product':
      return oneLine(`Product enquiry: ${d.interest}`);
    case 'career':
      return oneLine(`Job application: ${d.role} - ${lead.name}`);
    case 'service':
      return oneLine(`Service enquiry: ${d.serviceName}`);
    default:
      return oneLine(`Website enquiry: ${d.enquiryType}`);
  }
}

function bodyFor(lead) {
  const rows = [
    ['Form', FORM_LABEL[lead.form]],
    ['Name', oneLine(lead.name)],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ...Object.entries(lead.details).map(([key, value]) => [DETAIL_LABEL[key] || key, String(value)]),
  ];
  if (lead.form === 'career') rows.push(['CV attached', lead.cv ? `Yes (${lead.cv.filename})` : 'No']);
  const label = lead.form === 'pos' ? 'Additional requirements:' : lead.form === 'career' ? 'Note from applicant:' : 'Message:';
  return [
    ...rows.filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`),
    '',
    label,
    lead.message || '-',
    '',
    `Received: ${new Date().toISOString()}`,
  ].join('\n');
}

// Saves the enquiry first, then emails it. An email failure never loses the enquiry.
// Returns emailSent so the caller knows whether mail actually left the server.
export async function submitEnquiry(data, { pageUrl = '' } = {}) {
  // The roles offered on the Career page are the openings that are open right now.
  const openRoles = (await Job.find(openJobsFilter()).select('title').lean()).map((j) => j.title);
  const { errors, lead } = validateEnquiry(data, new Date(), openRoles);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  const routes = await EnquiryRoute.find({ enabled: true }).lean();
  const { routeKey, emails } = resolveRecipients(lead, routes);

  const doc = await Enquiry.create({
    form: lead.form,
    source: lead.source,
    category: lead.category,
    name: oneLine(lead.name),
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    cvFilename: lead.cv ? lead.cv.filename : '',
    pageUrl,
    details: lead.details,
    routeKey,
    routedTo: emails,
    emailSent: false,
    emailError: emails.length ? '' : NO_RECIPIENTS_MESSAGE,
  });

  let emailSent = false;
  if (emails.length) {
    try {
      const result = await sendMail({
        to: emails,
        subject: subjectFor(lead),
        text: bodyFor(lead),
        replyTo: { name: oneLine(lead.name).replace(/[<>"]/g, ''), address: lead.email },
        attachments: lead.cv
          ? [{ filename: lead.cv.filename, contentType: lead.cv.contentType, content: lead.cv.content }]
          : undefined,
      });
      if (result.sent) {
        emailSent = true;
        doc.emailError = '';
        doc.emailedAt = new Date();
      } else {
        // Test mode: the message was built but not sent. Say so, so nobody thinks the email went out.
        doc.emailError = TEST_MODE_MESSAGE;
      }
    } catch (err) {
      // Log the detail on the server only. The admin panel shows a plain message.
      console.error('[enquiry] email not sent:', err.message);
      doc.emailError =
        err.code === 'NOT_CONFIGURED'
          ? 'Not sent: email is not set up on the server (SMTP_USER and SMTP_PASS are missing). The enquiry is saved in the admin panel.'
          : 'Email delivery failed. The enquiry is saved and visible in the admin panel.';
    }
  }

  doc.emailSent = emailSent;

  // The customer gets a thank-you email as well. A failure here never loses the enquiry; the outcome is stored with it.
  const thankYou = await sendThankYou(lead, FORM_LABEL[lead.form]);
  doc.thankYouSent = thankYou.sent;
  doc.thankYouError = thankYou.error;
  await doc.save();

  return { ok: true, saved: true, id: String(doc._id), emailSent, thankYouSent: thankYou.sent };
}
