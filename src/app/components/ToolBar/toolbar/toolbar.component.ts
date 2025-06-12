import { Component} from '@angular/core'
import { StateService } from "../../../services/state.service";
import { UrlGenerationService } from "../../../services/url-generation.service";
import {EncoderService} from "../../../services/encoder.service";
import {DecoderService} from "../../../services/decoder.service";
import { NotificationService } from 'src/app/services/notification.service';
import { PanZoomService } from "../../../services/pan-zoom.service";

@Component({
    selector: 'app-toolbar',
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {

  constructor(
    private stateService: StateService,
    private notificationService: NotificationService,
    private panZoomService: PanZoomService
  ) {}


  selectedPanel: string = '';

  // Sets the currently active tab
  setCurrentTab(clickedPanel: string){
      if(clickedPanel==this.selectedPanel) {
        this.selectedPanel = '';
      }
      else{
          this.selectedPanel= clickedPanel;
      }
   }

  // Returns the name of the currently selected panel
  getSelected(): string {
      return this.selectedPanel;
  }

  // Handles sharing functionality by copying the generated URL to the clipboard
  handleShare() {
    //this.setCurrentTab("Share");
    let urlService = new UrlGenerationService(this.stateService, this.panZoomService);
    urlService.copyURL();
    this.notificationService.showNotification("Mechanism URL copied. If you make additional changes, copy the URL again.");
  }

  // Handles sharing functionality by copying the generated URL to the clipboard
  handleSave() {
    //this.setCurrentTab("Save");
    console.log("save button pressed");
    let encoderService = new EncoderService(this.stateService,this.panZoomService);
    let csv:string = encoderService.exportMechanismDataToCSV();
    console.log(csv);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date();
    a.download = "data-"+(date.getMonth()+1).toLocaleString('en-US', {minimumIntegerDigits: 2})+date.getDate().toLocaleString('en-US', {minimumIntegerDigits: 2})+(date.getHours().toLocaleString('en-US', {minimumIntegerDigits: 2}))+date.getMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2})+".csv";
    a.click();
    URL.revokeObjectURL(url);
    //todo notification of download
  }

  // Handles saving functionality by exporting data as CSV and triggering a file download
  handleLoadFile() {
    // Create a hidden file input object
    const fileInput: HTMLInputElement = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none'; // Keep it hidden
    document.body.appendChild(fileInput);
    // Handle the file selection
    fileInput.addEventListener('change', (event: Event): void => {
      const target = event.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        return; // User canceled
      }

      const fileList = target.files;
      const file: File = fileList[0];
      const reader: FileReader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        // e.target can be null in some edge cases, so check before using
        if (!e.target) {
          return;
        }
        // The file contents as text
        const fileContents: string = e.target.result as string;
        console.log('File Contents:', fileContents);
        DecoderService.decodeFromCSV(fileContents, this.stateService)

      };

      // Read file content as text
      reader.readAsText(file);
    });
    fileInput.click();
  }
}
