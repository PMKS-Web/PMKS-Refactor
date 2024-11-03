import { Injectable } from '@angular/core';
import { Mechanism } from '../model/mechanism';
import {BehaviorSubject} from "rxjs";

/*
Stores the global state of the application. This includes the model, global settings, and Pan/Zoom State. This is a singleton service.
Handles syncing client with server state, and undo/redo.
*/


@Injectable({
    providedIn: 'root'
})
export class StateService {

    private mechanism: Mechanism;
    //Need to use BehaviorSubjects when moving data between unrelated components
    private globalUnits = new BehaviorSubject("Metric (cm)");
    private globalUnitsSuffix = new BehaviorSubject("cm")
    private globalAngles = new BehaviorSubject("Degree (º)");
    private globalAnglesSuffix = new BehaviorSubject("º");
    private globalActivePanel = new BehaviorSubject("Edit");
    private synthesisHiddenJoints = new BehaviorSubject(false);
    globalUnitsCurrent = this.globalUnits.asObservable();
    globalUSuffixCurrent = this.globalUnitsSuffix.asObservable();
    globalAnglesCurrent = this.globalAngles.asObservable();
    globalASuffixCurrent = this.globalAnglesSuffix.asObservable();
    globalActivePanelCurrent = this.globalActivePanel.asObservable();
    synthesisHiddenJointsCurrent = this.synthesisHiddenJoints.asObservable();

    constructor() {
        console.log("StateService constructor");

        this.mechanism = new Mechanism();

    }

    public changeJointHiding(hidden: boolean) {
      this.synthesisHiddenJoints.next(hidden);
    }

    public changeActivePanel(panel: string): void {
      this.globalActivePanel.next(panel);
    }

    public changeUnits (units: string, suffix: string){
      this.globalUnits.next(units);
      this.globalUnitsSuffix.next(suffix);
    }

    public changeAngles (angles: string, suffix: string){
      this.globalAngles.next(angles);
      this.globalAnglesSuffix.next(suffix);
    }

    public getMechanism(): Mechanism {
        return this.mechanism;
    }
    public getMechanismObservable(){
        return this.mechanism._mechanismChange$;
    }
}
