import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CollapsibleSubsectionComponent } from '../../../Blocks/collapsible-subsection/collapsible-subsection.component'; // Adjust import path

@Component({
  selector: 'app-synthesis-panel',
  templateUrl: './synthesis-panel.component.html',
  styleUrls: ['./synthesis-panel.component.scss'],
})
export class SynthesisPanelComponent implements AfterViewInit {
  @ViewChild('threePosSynthesis') threePosSynthesis!: CollapsibleSubsectionComponent;

  sectionExpanded: { [key: string]: boolean } = {
    threePos: false,
    path: false,
  };

  constructor() {}

  ngAfterViewInit() {
    // Initialization code if needed
  }

  // Method to open the panel
  open() {
    // Open the collapsible subsection
    if (this.threePosSynthesis) {
      this.threePosSynthesis.open(); // Call a method on the collapsible subsection component to expand it
    }
  }
}
