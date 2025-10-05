import {Component, EventEmitter, Input, Output, OnInit, OnDestroy} from '@angular/core'
import { Subscription } from 'rxjs';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
import {StateService} from "../../../services/state.service";
import { AnimationService } from 'src/app/services/animation.service';
import {GridToggleService} from "../../../services/grid-toggle.service";

interface panel{
  gridenabled:boolean;
  minorgridenabled:boolean;

}

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.component.html',
  styleUrls: ['./settings-panel.component.scss'],

})
export class SettingsPanelComponent implements OnInit, OnDestroy{
  public open = true;

  sectionExpanded: { [key: string]: boolean } = {
    LBasic: true,
    LVisual: true,
  };

  gridEnabled: boolean= true;
  minorGridEnabled: boolean = true;
  units: string = "Metric (cm)";
  angles: string = "Degree (º)";
  unitSubscription: Subscription = new Subscription();
  anglesSubscription: Subscription = new Subscription();

  @Input() iconClass: string = ''; // Add this line

  constructor(private gridToggleService: GridToggleService, public toolbarComponent: ToolbarComponent, private stateService: StateService, public animationService: AnimationService) {
  
  }

  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  public value: boolean = this.gridEnabled;
  public onDirectionChanged(selection: string): void {
    this.animationService.animateMechanisms(false);
    this.animationService.reset();
    this.animationService.startDirectionCounterclockwise = (selection === 'Counterclockwise');
    this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();
  }

  // listen to current unit and angle from stateService and assign them to this class variable to show on screen correctly
  ngOnInit(): void {
      this.unitSubscription = this.stateService.globalUnitsCurrent.subscribe((currentUnit) => {
        this.units = currentUnit; 
      });

      this.anglesSubscription = this.stateService.globalAnglesCurrent.subscribe((currentAngle)=>{
        this.angles = currentAngle;
      })
  }

  ngOnDestroy(): void {
      this.unitSubscription.unsubscribe();
      this.anglesSubscription.unsubscribe();
  }

  //Controls when the user changes the unit
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

  // Handles the user changing the angle unit (e.g., degrees or radians)
  changeAngle(newAngle: string){
    if (newAngle === "Radian (rad)"){
      this.stateService.changeAngles(newAngle, "rad")
    }
    else this.stateService.changeAngles(newAngle, "º");
  }

  // Toggles both the grid and minor grid, and emits value change
  toggle() {
    this.value = !this.value;
    this.valueChanged.emit(this.value);

    this.gridEnabled = !this.gridEnabled;
    this.gridToggleService.setGridEnabled(this.gridEnabled);

    this.minorGridEnabled = !this.minorGridEnabled;
    this.gridToggleService.setMinorGridEnabled(this.minorGridEnabled);
  }

  // Toggles only the minor grid and emits value change
  toggleMinor() {
    this.value = !this.value;
    this.valueChanged.emit(this.value);

    this.minorGridEnabled = !this.minorGridEnabled;
    this.gridToggleService.setMinorGridEnabled(this.minorGridEnabled);
  }

  // Closes the settings panel if the user clicks outside of it
  closePanel(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings')) {
      setItem<panel>('preferences', { minorgridenabled: this.minorGridEnabled, gridenabled: this.gridEnabled }); //remembers grid settings, not completed as I don't have knowledge to store information
      this.open = false;
      this.toolbarComponent.setCurrentTab('');
    }
  }

  // Updates the gridEnabled flag when a toggle change is received
  handleToggleGridChange(stateChange: boolean){
    this.gridEnabled=stateChange;
    return this.gridEnabled
  }

  // Returns whether the grid is currently enabled
  getGridEnabled(): boolean{
    return this.handleToggleGridChange(this.gridEnabled);
  }
}
  function setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
}
