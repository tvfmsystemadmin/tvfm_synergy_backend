import { cleanText, hasOwn, isDateString } from './strings.js';
import { SOURCE_TO_FORM } from '../config/constants.js';

export const PRODUCT_INTERESTS = ['Buying products', 'Distributorship', 'Other'];
// Fallback list only. The live site passes the job titles that are open right now (see services/enquiryService.js).
export const CAREER_ROLES = ['Sales Manager', 'Sales Executive', 'Salon Training Specialist'];
export const CAREER_EXPERIENCE = ['Fresher', 'Less than 1 year', '1 to 3 years', '3 to 5 years', 'More than 5 years'];

const CV_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
const CV_MAX_BYTES = 2 * 1024 * 1024;

export const emailOk = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export const phoneOk = (value) => {
  const digits = value.replace(/\D/g, '');
  return /^[+\d\s()-]{7,20}$/.test(value) && digits.length >= 7 && digits.length <= 15;
};

// Applicants must be between 16 and 70 years old on the day they apply.
export function ageOk(dob, now = new Date()) {
  const birth = new Date(dob);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 16 && age <= 70;
}

function parseCv(cv, errors) {
  if (!cv || typeof cv !== 'object' || !cv.data) return null;
  const type = cleanText(cv.type, 100);
  if (!hasOwn(CV_TYPES, type)) {
    errors.cv = 'Upload your CV as a PDF, DOC or DOCX file.';
    return null;
  }
  if (typeof cv.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(cv.data)) {
    errors.cv = 'The CV could not be read. Please upload it again.';
    return null;
  }
  const content = Buffer.from(cv.data, 'base64');
  if (content.length === 0 || content.length > CV_MAX_BYTES) {
    errors.cv = 'The CV must be 2 MB or smaller.';
    return null;
  }
  const base = (cleanText(cv.name, 120) || 'cv').replace(/\.[A-Za-z]+$/, '').replace(/[^\w .-]/g, '_') || 'cv';
  return { filename: `${base}.${CV_TYPES[type]}`, contentType: type, content };
}

// Checks a submitted website form. Returns { errors, lead } where lead is a clean copy of the data.
// openRoles: the job titles open right now (from the Job openings page). Defaults to the built-in list.
export function validateEnquiry(data, now = new Date(), openRoles = CAREER_ROLES) {
  const errors = {};
  const source = cleanText(data.source, 40);
  const form = hasOwn(SOURCE_TO_FORM, source) ? SOURCE_TO_FORM[source] : null;
  if (!form) return { errors: { source: 'Unknown form.' }, lead: null };

  const lead = {
    form,
    source,
    category: '',
    name: cleanText(data.fullName ?? data.name, 100),
    email: cleanText(data.email, 254),
    phone: cleanText(data.mobile ?? data.phone, 20),
    message: '',
    details: {},
  };

  if (lead.name.length < 2) errors.name = 'Enter your name.';
  if (!emailOk(lead.email)) errors.email = 'Enter a valid email address.';
  if (!phoneOk(lead.phone)) errors.phone = 'Enter a valid phone number.';
  const consentGiven = data.consent === true;

  if (form === 'pos') {
    const businessName = cleanText(data.businessName, 120);
    const city = cleanText(data.city, 80);
    const branches = Number(data.branches);
    lead.message = cleanText(data.requirements, 2000);
    lead.details = { businessName, city, branches };
    if (!businessName) errors.businessName = 'Enter your salon or business name.';
    if (!city) errors.city = 'Enter your city.';
    if (!Number.isInteger(branches) || branches < 1 || branches > 999) {
      errors.branches = 'Enter a whole number from 1 to 999.';
    }
    if (!consentGiven) errors.consent = 'Please agree so the team can contact you.';
  } else if (form === 'product') {
    const city = cleanText(data.city, 80);
    const interest = cleanText(data.interest, 100);
    lead.category = interest;
    lead.message = cleanText(data.message, 3000);
    lead.details = { city, interest };
    if (!PRODUCT_INTERESTS.includes(interest)) errors.interest = 'Choose what you are interested in.';
    if (!consentGiven) errors.consent = 'Please agree so the team can contact you about our products.';
  } else if (form === 'contact') {
    const enquiryType = cleanText(data.enquiryType, 100);
    lead.category = enquiryType;
    lead.message = cleanText(data.message, 3000);
    lead.details = { enquiryType };
    if (!enquiryType) errors.enquiryType = 'Choose an enquiry type.';
    if (lead.message.length < 5) errors.message = 'Enter your message.';
  } else if (form === 'service') {
    const serviceName = cleanText(data.serviceName, 120);
    lead.category = serviceName;
    lead.message = cleanText(data.message, 3000);
    lead.details = { serviceName };
    if (!serviceName) errors.serviceName = 'Choose a service.';
    if (lead.message.length < 5) errors.message = 'Enter your message.';
    if (!consentGiven) errors.consent = 'Please agree so the team can contact you.';
  } else {
    const dob = cleanText(data.dob, 10);
    const city = cleanText(data.city, 80);
    const role = cleanText(data.role, 100);
    const experience = cleanText(data.experience, 40);
    const qualification = cleanText(data.qualification, 200);
    const lastRole = cleanText(data.lastRole, 200);
    const availableFrom = cleanText(data.availableFrom, 10);
    lead.category = role;
    lead.message = cleanText(data.note, 2000);
    lead.details = { dob, city, role, experience, qualification, lastRole, availableFrom };
    if (!isDateString(dob) || !ageOk(dob, now)) errors.dob = 'Enter your date of birth. You must be between 16 and 70.';
    if (!city) errors.city = 'Enter your city.';
    // Applications are for a job opening only. The role must be one of the openings that are open right now.
    if (!openRoles.includes(role)) errors.role = 'This job is no longer open for applications.';
    if (!CAREER_EXPERIENCE.includes(experience)) errors.experience = 'Choose your experience.';
    if (qualification.length < 2) errors.qualification = 'Enter your highest qualification.';
    if (availableFrom && !isDateString(availableFrom)) errors.availableFrom = 'Check the date you can start.';
    if (!consentGiven) errors.consent = 'Please agree so the team can contact you about this application.';
    const cv = parseCv(data.cv, errors);
    if (cv) lead.cv = cv;
  }

  return { errors, lead };
}
