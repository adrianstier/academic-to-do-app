import { config } from './config';

interface EmailData {
  subject: string;
  from: string;
  received: Date;
  itemId: string;
  body: string;
}

let emailData: EmailData | null = null;

// Initialize Office
Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    loadEmailData();
  }
});

async function loadEmailData(): Promise<void> {
  const initMessage = document.getElementById('init-message');
  const formContainer = document.getElementById('form-container');

  try {
    const item = Office.context.mailbox.item;

    if (!item) {
      showError('No email selected');
      return;
    }

    // Get email body
    const bodyText = await new Promise<string>((resolve, reject) => {
      item.body.getAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value);
        } else {
          reject(new Error(result.error?.message || 'Failed to get email body'));
        }
      });
    });

    emailData = {
      subject: item.subject || '',
      from: item.from?.emailAddress || item.from?.displayName || 'Unknown',
      received: item.dateTimeCreated || new Date(),
      itemId: item.itemId || '',
      body: bodyText.substring(0, 500), // First 500 chars
    };

    // Populate form
    populateForm();

    // Show form
    if (initMessage) initMessage.style.display = 'none';
    if (formContainer) formContainer.classList.add('show');

    // Setup form handler
    setupFormHandler();

  } catch (error) {
    console.error('Error loading email:', error);
    showError(error instanceof Error ? error.message : 'Failed to load email');
  }
}

function populateForm(): void {
  if (!emailData) return;

  // Set title
  const titleInput = document.getElementById('title') as HTMLInputElement;
  if (titleInput) {
    titleInput.value = emailData.subject;
  }

  // Set description (first part of body)
  const descInput = document.getElementById('description') as HTMLTextAreaElement;
  if (descInput) {
    descInput.value = emailData.body.length > 200
      ? emailData.body.substring(0, 200) + '...'
      : emailData.body;
  }

  // Set due date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);

  const dueDateInput = document.getElementById('dueDate') as HTMLInputElement;
  if (dueDateInput) {
    dueDateInput.value = formatDateTimeLocal(tomorrow);
  }

  // Set reminder to today at 4pm or next hour if past 4pm
  const reminderDate = new Date();
  if (reminderDate.getHours() >= 16) {
    reminderDate.setHours(reminderDate.getHours() + 1, 0, 0, 0);
  } else {
    reminderDate.setHours(16, 0, 0, 0);
  }

  const reminderInput = document.getElementById('reminderTime') as HTMLInputElement;
  if (reminderInput) {
    reminderInput.value = formatDateTimeLocal(reminderDate);
  }

  // Show email info
  const emailInfo = document.getElementById('email-info');
  if (emailInfo) {
    emailInfo.innerHTML = `
      <strong>From:</strong> ${escapeHtml(emailData.from)}<br>
      <strong>Received:</strong> ${emailData.received.toLocaleString()}
    `;
  }
}

function setupFormHandler(): void {
  const form = document.getElementById('task-form') as HTMLFormElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await createTask();
  });
}

async function createTask(): Promise<void> {
  if (!emailData) {
    showError('No email data available');
    return;
  }

  const titleInput = document.getElementById('title') as HTMLInputElement;
  const descInput = document.getElementById('description') as HTMLTextAreaElement;
  const assigneeSelect = document.getElementById('assignee') as HTMLSelectElement;
  const dueDateInput = document.getElementById('dueDate') as HTMLInputElement;
  const reminderInput = document.getElementById('reminderTime') as HTMLInputElement;
  const loading = document.getElementById('loading');
  const buttons = document.getElementById('buttons');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

  const title = titleInput.value.trim();
  if (!title) {
    showError('Title is required');
    return;
  }

  // Show loading state
  if (loading) loading.classList.add('show');
  if (buttons) buttons.style.display = 'none';
  submitBtn.disabled = true;

  try {
    const taskData = {
      title,
      description: descInput.value.trim() || undefined,
      status: 'todo',
      assignee: assigneeSelect.value || undefined,
      dueDate: dueDateInput.value ? new Date(dueDateInput.value).toISOString() : undefined,
      reminderTime: reminderInput.value ? new Date(reminderInput.value).toISOString() : undefined,
      sourceEmailId: emailData.itemId,
      sourceEmailFrom: emailData.from,
      sourceEmailReceived: emailData.received.toISOString(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['X-API-KEY'] = config.apiKey;
    }

    const response = await fetch(`${config.apiUrl}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create task (${response.status})`);
    }

    const task = await response.json();
    showSuccess('Task created successfully!');

    // Reset form after success
    setTimeout(() => {
      if (loading) loading.classList.remove('show');
      if (buttons) buttons.style.display = 'flex';
      submitBtn.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Error creating task:', error);
    showError(error instanceof Error ? error.message : 'Failed to create task');

    if (loading) loading.classList.remove('show');
    if (buttons) buttons.style.display = 'flex';
    submitBtn.disabled = false;
  }
}

function showMessage(message: string, type: 'success' | 'error'): void {
  const container = document.getElementById('message-container');
  if (!container) return;

  container.innerHTML = `<div class="message ${type}">${escapeHtml(message)}</div>`;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showSuccess(message: string): void {
  showMessage(message, 'success');
}

function showError(message: string): void {
  showMessage(message, 'error');
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
