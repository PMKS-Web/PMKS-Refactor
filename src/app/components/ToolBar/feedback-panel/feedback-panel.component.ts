import { Component } from '@angular/core';
import { InteractionService } from 'src/app/services/interaction.service'
import { FormBuilder, FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';

@Component({
  selector: 'app-feedback-panel',
  templateUrl: './feedback-panel.component.html',
  styleUrls: ['./feedback-panel.component.scss'],
})

export class FeedbackPanelComponent {

  sectionExpanded: { [key: string]: boolean } = {
    LBasic: true,
    LVisual: true,
  };



  gridEnabled: boolean= true;
  minorGridEnabled: boolean = true;
  public open = true

  constructor(private interactionService: InteractionService, private fb: FormBuilder, public toolbarComponent: ToolbarComponent){
  }

  commentForm = this.fb.group({
    comment: ['', Validators.required],
    email: ['', Validators.email],
    response: [false],
    diagnostics: [true],
    project: [true],
  });

  closePanel(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings')) {
      this.open = false;
      this.toolbarComponent.setCurrentTab('');
    }
  }

  matcher = new MyErrorStateMatcher();

  gotoGithub() {
    //Open a new tab to this site: https://pmks.mech.website/pmks-web-how-to-videos/
    window.open('https://github.com/PMKS-Web/PMKS-Refactor', '_blank');
  }

}

/** Error when invalid control is dirty, touched, or submitted. */
export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
  }
}
