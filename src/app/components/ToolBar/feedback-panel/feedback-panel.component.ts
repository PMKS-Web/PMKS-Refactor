import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-panel.component.html',
  styleUrls: ['./feedback-panel.component.scss']
})
export class FeedbackPanelComponent {
  @Input() open = false;

  message = '';
  wantsResponse = false;
  sendBrowserInfo = true;
  sendProject = true;
  isSending       = false;

  private readonly PUBLIC_KEY   = 'iMSBjQt9hHdRwxdWh';
  private readonly SERVICE_ID   = 'service_s7g1ljp';
  private readonly TEMPLATE_ID  = 'template_xjc8mma';

  constructor(private toolbar: ToolbarComponent) {
    emailjs.init(this.PUBLIC_KEY);
  }

  sendFeedback() {
    if (!this.message.trim()) {
      alert("Please enter a message before sending.");
      return;
    }

    this.isSending = true;


    const templateParams = {
      user_message:   this.message,
      wants_response: this.wantsResponse,
      browser_info:   this.sendBrowserInfo ? navigator.userAgent : 'omitted',
      project_dump:   this.sendProject     ? '...data...' : 'omitted'
    };

    emailjs
      .send(this.SERVICE_ID, this.TEMPLATE_ID, templateParams)
      .then((res: EmailJSResponseStatus) => {
        alert('Feedback sent! Thank you.');
        this.message = '';
      })
      .catch(err => {
        console.error('EmailJS error:', err);
        alert('Oops, something went wrong. Please try again later.');
      })
      .finally(() => {
        this.isSending = false;
      });
  }


  closePanel(event: MouseEvent) {

    this.open = false;
    this.toolbar.setCurrentTab('');
  }
}
