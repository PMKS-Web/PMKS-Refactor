import {Component, EventEmitter, Input, Output} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
import {StateService} from "../../../services/state.service";
import {Subscription} from "rxjs";
import { AnimationService } from 'src/app/services/animation.service';

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
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  units: string = "Metric (cm)";
  angles: string = "Degree (º)";

  @Input() iconClass: string = ''; // Add this line

  constructor(private interactionService: InteractionService, public toolbarComponent: ToolbarComponent, private stateService: StateService, public animationService: AnimationService) {

  }
  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  public value: boolean = this.gridEnabled;

  ngOnInit() {
    this.unitSubscription = this.stateService.globalUnitsCurrent.subscribe((units) => {this.units = units;});
    this.angleSubscription = this.stateService.globalAnglesCurrent.subscribe((angles) => {this.angles = angles;});
  }


  public onDirectionChanged(selection: string): void {
    this.animationService.animateMechanisms(false);
    this.animationService.reset();
    this.animationService.startDirectionCounterclockwise = (selection === 'Counterclockwise');
    this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();
  }


  changeUnits(newUnits: string){
    console.log(newUnits);
    if (newUnits === "English (in)"){
      this.stateService.changeUnits(newUnits, "in")
    }
    else if (newUnits === "SI (m)"){
      this.stateService.changeUnits(newUnits, "m")
    }
    else this.stateService.changeUnits(newUnits, "cm");
  }

  changeAngle(newAngle: string){
    if (newAngle === "Radian (rad)"){
      this.stateService.changeAngles(newAngle, "rad")
    }
    else this.stateService.changeAngles(newAngle, "º");
  }

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

  ngOnDestroy() {
    this.unitSubscription.unsubscribe();
    this.angleSubscription.unsubscribe();
  }

  protected readonly AnimationService = AnimationService;
}
function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
function getItem<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) as T : null;
}
