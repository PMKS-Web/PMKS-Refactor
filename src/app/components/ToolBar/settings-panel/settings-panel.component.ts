import {Component, EventEmitter, Input, Output} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';

interface panel{
  gridenabled:boolean;
  minorgridenabled:boolean;

}

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.component.html',
  styleUrls: ['./settings-panel.component.scss'],

})
export class SettingsPanelComponent{
  public open = true;

  sectionExpanded: { [key: string]: boolean } = {
    LBasic: true,
    LVisual: true,
  };

  gridEnabled: boolean= true;
  minorGridEnabled: boolean = true;
  @Input() iconClass: string = ''; // Add this line

  constructor(private interactionService: InteractionService, public toolbarComponent: ToolbarComponent){

  }
  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  public value: boolean = this.gridEnabled;

  toggle() {
    this.value = !this.value;
    this.valueChanged.emit(this.value);
  }

  closePanel(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings')) {
      setItem<panel>('preferences', { minorgridenabled: this.minorGridEnabled, gridenabled: this.gridEnabled }); //remembers grid settings, not completed as I don't have knowledge to store information
      this.open = false;
      this.toolbarComponent.setCurrentTab('');
    }
  }
  handleToggleGridChange(stateChange: boolean){
    this.gridEnabled=stateChange;
    return this.gridEnabled
  }

  getGridEnabled(): boolean{
    return this.handleToggleGridChange(this.gridEnabled);
  }

  handleToggleMinorGridChange(stateChange: boolean){
    this.minorGridEnabled=stateChange;
  }

  getMinorGridEnabled(): boolean{
    return this.minorGridEnabled;
  }

}
function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
function getItem<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) as T : null;
}
