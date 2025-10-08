import { Component } from '@angular/core';
import { StateService } from '../../../services/state.service';
import { NotificationService } from 'src/app/services/notification.service';

interface Tab {
  selected: boolean;
  label: string;
  icon: string;
  id: string;
}

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
})
export class SidenavComponent {
  // Array of navigation tabs shown in the side menu
  tabs: Tab[] = [
    {
      selected: false,
      label: 'Synthesis',
      icon: 'assets/sidenav/synthesize.svg',
      id: 'sidenav-synthesis-button'
    },
    {
      selected: true,
      label: 'Edit',
      icon: 'assets/sidenav/edit.svg',
      id: 'sidenav-edit-button'
    },
    {
      selected: false,
      label: 'Analysis',
      icon: 'assets/sidenav/analyze.svg',
      id: 'sidenav-analysis-button'
    },
  ];

  generatedCheck: boolean = false;

  sidePanels = document.getElementsByClassName('app-panel-container');

  constructor(
    private stateService: StateService,
    private notificationService: NotificationService
  ) {}

  // Called when synthesis panel emits a generated state
  changeGeneratedCheck(changeTo: boolean): void {
    this.generatedCheck = changeTo;
  }

  // Toggles visibility of a panel when a tab is clicked/*  */
  togglePanel(clickedTab: string): void {
    let editPanel = this.sidePanels[0].children[0];
    let synthPanel = this.sidePanels[0].children[1];
    let analysisPanel = this.sidePanels[0].children[2];

    //closing the tab after click again
    if (this.isSelected(clickedTab)) {
      this.tabs[1].selected = false;
      this.tabs[2].selected = false;
      this.tabs[0].selected = false;
      this.hide(synthPanel);
      this.hide(analysisPanel);
      this.hide(editPanel);
      this.stateService.changeActivePanel('Edit');
      return;
    }

    // There has to be a better way to do this but I'm on a time crunch
    if (clickedTab === 'Edit') {
      if (this.tabs[0].selected && this.stateService.fourBarGenerated) {
        this.notificationService.showWarning(
          'Modifying synthesized mechanisms will cause them to be invalid. ' //The synthesis panel will reset upon returning if you perform any modification
        );
      }
      this.tabs[1].selected = true;
      this.tabs[2].selected = false;
      this.tabs[0].selected = false;
      this.hide(synthPanel);
      this.hide(analysisPanel);
      this.unHide(editPanel);
      this.stateService.changeActivePanel('Edit');
    } else if (clickedTab === 'Synthesis') {
      this.tabs[0].selected = true;
      this.tabs[1].selected = false;
      this.tabs[2].selected = false;
      this.hide(editPanel);
      this.hide(analysisPanel);
      this.unHide(synthPanel);
      this.stateService.changeActivePanel('Synthesis');
    } else {
      this.tabs[2].selected = true;
      this.tabs[0].selected = false;
      this.tabs[1].selected = false;
      this.hide(editPanel);
      this.hide(synthPanel);
      this.unHide(analysisPanel);
      this.stateService.changeActivePanel('Analysis');
    }
  }

  // Checks if a given tab label is currently selected
  isSelected(id: string): boolean {
    return this.tabs.find((tab) => tab.label === id)?.selected ?? false;
  }

  // Unhides the given panel element
  unHide(panel: Element) {
    panel.removeAttribute('hidden');
  }

  // Hides the given panel element
  hide(panel: Element): void {
    panel.setAttribute('hidden', 'true');
  }
}
