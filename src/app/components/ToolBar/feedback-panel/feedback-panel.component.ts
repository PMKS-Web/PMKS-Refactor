import { Component, Input } from '@angular/core';
import {CommonModule, NgIf} from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';
import { UrlGenerationService } from '../../../services/url-generation.service';

@Component({
  selector: 'app-feedback-panel',
  templateUrl: './feedback-panel.component.html',
  styleUrls: ['./feedback-panel.component.scss'],
  imports: [
    FormsModule,
    NgIf
  ],
  standalone: true
})
export class FeedbackPanelComponent {
  @Input() open = false;

  message = '';
  wantsResponse = false;
  sendBrowserInfo = true;
  sendProject = true;
  isSending = false;
  userEmail = '';

  private readonly PUBLIC_KEY = 'Zt9zocAWwnjuoRu4k';
  private readonly SERVICE_ID = 'service_w5sn9tv';
  private readonly TEMPLATE_ID = 'template_jwey1mq';

  constructor(
    private toolbar: ToolbarComponent,
    private urlGen: UrlGenerationService
  ) {
    emailjs.init(this.PUBLIC_KEY);
  }

  sendFeedback() {
    if (!this.message.trim()) {
      alert('Please enter a message before sending.');
      return;
    }

    // require email if they asked for a response
    if (this.wantsResponse && !this.userEmail.trim()) {
      return alert('Please enter your email if you want a response.');
    }

    this.isSending = true;

    const templateParams = {
      user_message: this.message,
      wants_response: this.wantsResponse,
      browser_info: this.sendBrowserInfo ? navigator.userAgent : 'omitted',
      project_dump: this.sendProject ? this.urlGen.generateUrl : 'omitted',
      email: this.userEmail,
    };

    emailjs
      .send(this.SERVICE_ID, this.TEMPLATE_ID, templateParams)
      .then((res: EmailJSResponseStatus) => {
        alert('Feedback sent! Thank you.');
        this.message = '';
      })
      .catch((err) => {
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
