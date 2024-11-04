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
    private globalAngles = new BehaviorSubject("Degree (º)");
    globalUnitsCurrent = this.globalUnits.asObservable();
    globalAnglesCurrent = this.globalAngles.asObservable();

    constructor() {
        console.log("StateService constructor");

        this.mechanism = new Mechanism();

    }

    public changeUnits (units: string){
      this.globalUnits.next(units);
    }

    public changeAngles (angles: string){
      this.globalAngles.next(angles);
    }

    public getMechanism(): Mechanism {
        return this.mechanism;
    }
    public getMechanismObservable(){
        return this.mechanism._mechanismChange$;
    }
}
