import {Component, inject, OnInit} from '@angular/core';
// @ts-ignore
//import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';

@Component({
  selector: 'app-share-panel',
  templateUrl: './share-panel.component.html',
  styleUrls: ['./share-panel.component.css']
})
export class SharePanelComponent implements OnInit{
  //private analytics: Analytics = inject(Analytics);

  static instance: SharePanelComponent;

  constructor(
    private urlGenerationService: UrlGenerationService,
  ) {
    SharePanelComponent.instance = this;
  }

  ngOnInit(){
    this.copyURL()
  }
  /**
   * helper, deals with the asynchronous nature of writing text
   */
  private async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  /**
   * full
   */
  copyURL() {
    console.log('copyURL');
    let url = this.urlGenerationService.generateUrl(); //todo TEST
    let promise = this.copyToClipboard(url);

     // DEPRECATED? -  fake a text area to execute copy - might need - keep
    //const toolman = document.createElement('textarea');
    //document.body.appendChild(toolman);
    //toolman.value = url;
    //toolman.textContent = url;
    //toolman.select();
    //attempt to update the clipboard
    //let promise = this.copyToClipboard(url);
    //deprecated??
    // get rid of the mess
    //document.body.removeChild(toolman);
    //toolman.remove();

    console.log('Mechanism URL copied. If you make additional changes, copy the URL again.');

  }
}
