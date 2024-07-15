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
  constructor(){
  }

  togglePanel(clickedTab: string): void {
    this.tabs.forEach(tab => {
      if (tab.label === clickedTab) {
        tab.selected = !tab.selected; // Toggle selected state
      } else {
        tab.selected = false; // Close other panels
      }
    });
  }

  setCurrentTab(clickedTab: string){
    this.tabs.forEach((tab)=>{
      if(tab.label == clickedTab){
        tab.selected = true;
      } else{
        tab.selected = false;
      }
    });

  }

  isSelected(id: string): boolean {
    return this.tabs.find(tab => tab.label === id)?.selected ?? false;
  }
  togglePanel(clickedTab: string): void {
    this.tabs.forEach(tab => {
      if (tab.label === clickedTab) {
        tab.selected = !tab.selected; // Toggle selected state
      } else {
        tab.selected = false; // Close other panels
      }
    });
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
