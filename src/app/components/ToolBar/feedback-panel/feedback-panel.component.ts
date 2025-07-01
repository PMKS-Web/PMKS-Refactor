import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';

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

  constructor(private toolbar: ToolbarComponent) {}

  sendFeedback() {
    if (!this.message.trim()) {
      alert("Please enter a message before sending.");
      return;
    }
    console.log("Message:", this.message);
    alert("Feedback sent! (simulation)");
    this.message = '';
  }

  closePanel(event: MouseEvent) {

    this.open = false;
    // tell the toolbar to clear its tab so this panel unmounts
    this.toolbar.setCurrentTab('');
  }
}
