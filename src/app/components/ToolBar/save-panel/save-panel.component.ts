import { Component, inject, OnInit } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';

@Component({
  selector: 'app-save-panel',
  templateUrl: './save-panel.component.html',
  styleUrl: './save-panel.component.css'
})
export class SavePanelComponent implements OnInit{

  private analytics: Analytics = inject(Analytics);

  static instance: SavePanelComponent;

  constructor(
    private urlGenerationService: UrlGenerationService,

  ) {
    SavePanelComponent.instance = this;
  }
  ngOnInit(){
    this.downloadLinkage()
  }
  downloadLinkage() {
    // logEvent(this.analytics, 'download_linkage');
    // // TODO: Believe this should be this.unit.selectedUnit
    // const content = this.urlGenerationService.generateUrlQuery();
    //
    // const blob = new Blob([content], { type: 'text;charset=utf-8;' });
    // const fileName = `PMKS+_${new Date().toISOString()}.pmks`;
    // // if (navigator.msSaveBlob) { // IE 10+
    // //   navigator.msSaveBlob(blob, fileName);
    // // } else {
    // const link = document.createElement('a');
    // if (link.download !== undefined) {
    //   // feature detection
    //   // Browsers that support HTML5 download attribute
    //   // fake an <a> to click on
    //   const url = URL.createObjectURL(blob);
    //   link.setAttribute('href', url);
    //   link.setAttribute('download', fileName);
    //   link.style.visibility = 'hidden';
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
    // }
  }
}
