import { Component} from '@angular/core'

interface Tab {
    selected: boolean,
    label: string,
    icon: string
}


@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: [ './sidenav.component.scss'],

})
export class SidenavComponent {

  tabs: Tab[] = [
    {selected: false, label: 'Synthesis',icon: 'assets/sidenav/synthesize.svg'},
    {selected: true, label: 'Edit',icon: 'assets/sidenav/edit.svg'},
    {selected: false, label: 'Analysis', icon:'assets/sidenav/analyze.svg'},
  ];

  generatedCheck: boolean = false;

  sidePanels = document.getElementsByClassName('app-panel-container');


  constructor(){
  }

  changeGeneratedCheck(changeTo: boolean): void {
    this.generatedCheck = changeTo;
  }

  togglePanel(clickedTab: string): void {
    let editPanel = this.sidePanels[0].children[0];
    let synthPanel = this.sidePanels[0].children[1];
    let analysisPanel = this.sidePanels[0].children[2];
    // There has to be a better way to do this but I'm on a time crunch
    if (clickedTab === "Edit"){
      if (this.tabs[0].selected && this.generatedCheck){
        window.alert("Warning: Adding or removing links, joints, grounds, and inputs to the synthesized mechanism will " +
          "cause that synthesis to be voided. The synthesis panel will be reset upon returning to it if you perform any of these actions.")
      }
      this.tabs[1].selected = true;
      this.tabs[2].selected = false;
      this.tabs[0].selected = false;
      this.hide(synthPanel);
      this.hide(analysisPanel);
      this.unHide(editPanel);
    }
    else if (clickedTab === "Synthesis"){
      this.tabs[0].selected = true;
      this.tabs[1].selected = false;
      this.tabs[2].selected = false;
      this.hide(editPanel);
      this.hide(analysisPanel);
      this.unHide(synthPanel);
    }
    else {
      this.tabs[2].selected = true;
      this.tabs[0].selected = false;
      this.tabs[1].selected = false;
      this.hide(editPanel);
      this.hide(synthPanel);
      this.unHide(analysisPanel);
    }
    }


  isSelected(id: string): boolean {
    return this.tabs.find(tab => tab.label === id)?.selected ?? false;
  }

  unHide(panel: Element) {
    panel.removeAttribute("hidden");
  }

  hide(panel: Element): void {
    panel.setAttribute("hidden", "true")
  }

getSelected(): string {
    let selectedTab = '';
    this.tabs.forEach((tab)=>{
      if(tab.selected){
        selectedTab = tab.label;
      }
    });
    return selectedTab;
  }


}
