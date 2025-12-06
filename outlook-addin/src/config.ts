// Configuration for the Outlook add-in
export const config = {
  // API endpoint for the to-do server
  apiUrl: 'http://localhost:5566',

  // Optional API key for authentication
  // Set this to match the API_KEY in your server's .env file
  apiKey: '',

  // Default assignee options
  assignees: ['Derrick', 'Sefra'],

  // Default assignee for new tasks
  defaultAssignee: 'Sefra',
};
