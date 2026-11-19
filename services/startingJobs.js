import Job from '../models/Job.js';

// The three roles the Career page showed before job openings were managed in the admin panel.
// Added only when there are no openings yet, so nothing edited or added later is overwritten.
export function startingJobs() {
  return [
    {
      title: 'Sales Manager',
      type: 'Full time',
      place: 'Chennai',
      summary: 'Lead the sales team for salon POS software and professional products, and build lasting relationships with salon owners.',
      duties: [
        'Plan and track monthly sales targets for the team',
        'Coach and guide sales executives in the field and by phone',
        'Build relationships with salon owners, distributors and franchise partners',
        'Report on pipeline, wins and lost enquiries each week',
      ],
      needs: [
        'Experience in B2B or retail sales, ideally in beauty or salon businesses',
        'Confident in demonstrating software and explaining products',
        'Clear communication in Tamil and English',
      ],
      order: 1,
    },
    {
      title: 'Sales Executive',
      type: 'Full time',
      place: 'Chennai and nearby areas',
      summary: 'Meet salon owners, explain our POS software and product range, and help them choose what suits their business.',
      duties: [
        'Visit and call salon owners to introduce POS software and products',
        'Arrange product demonstrations and walkthroughs',
        'Record every enquiry and follow up within the agreed time',
        'Pass on feedback from salons to the product and support team',
      ],
      needs: [
        'Good communication and a friendly, practical approach',
        'Comfortable using a phone, WhatsApp and a simple sales tool',
        'Interest in beauty, salons or retail is a strong plus',
      ],
      order: 2,
    },
    {
      title: 'Salon Training Specialist',
      type: 'Full time',
      place: 'Chennai',
      summary: 'Train salon teams in service standards, client care and POS software, so each salon works confidently after we leave.',
      duties: [
        'Deliver training sessions for salon owners and staff',
        'Create simple guides for service standards and the POS software',
        'Check skills and set learning plans for each team member',
        'Support salons after training with follow-up visits or calls',
      ],
      needs: [
        'Experience in salon services, beauty training or teaching',
        'Patient, clear and practical when showing people how to do a task',
        'Willingness to travel within the region for training days',
      ],
      order: 3,
    },
  ];
}

// Returns how many openings were added (0 when the list already has some).
export async function createStartingJobs() {
  if (await Job.exists({})) return 0;
  const docs = startingJobs();
  await Job.insertMany(docs);
  return docs.length;
}
