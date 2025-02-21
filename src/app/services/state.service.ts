import { Injectable } from '@angular/core';
import { Mechanism } from '../model/mechanism';
import {BehaviorSubject} from "rxjs";
import {DecoderService} from "./decoder.service";

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
    globalUnitsCurrent = this.globalUnits.asObservable();
    globalUSuffixCurrent = this.globalUnitsSuffix.asObservable();
    globalAnglesCurrent = this.globalAngles.asObservable();
    globalASuffixCurrent = this.globalAnglesSuffix.asObservable();
    globalActivePanelCurrent = this.globalActivePanel.asObservable();

    constructor() {
        console.log("StateService constructor");
        let url = window.location.href;
        //if loading from URL
        if (url.includes("?data=")) {
          const encodedData = url.split("?data=")[1];
          this.mechanism = this.reconstructFromUrl(DecoderService.decodeFromURL(encodedData,this));
          //reset url to normal
          window.location.href = url.split("?data=")[0];
        } else {
          this.mechanism = new Mechanism();
        }
    }

  /**
   * Returns a mechanism that is correctly configured,
   *  given a structured data array from the decoder service
   * @param rawData
   */
  public reconstructFromUrl(rawData: any):Mechanism { //url: string, paramName: string = 'data'): void {
    // Build a fresh Mechanism
    const newMechanism = new Mechanism();

    if (rawData.joints) {
      for (const joint of rawData.joints) {
        newMechanism._addJoint(joint);
      }
    }
      //todo
    if (rawData.links) {
      for (const [idStr, linkData] of Object.entries(rawData.links)) {
        newMechanism.addLink(Number(idStr), linkData);
      }
    }

    if (rawData.compoundLinks) {
      for (const [idStr, compoundLinkData] of Object.entries(rawData.compoundLinks)) {
        newMechanism.addCompoundLink(Number(idStr), compoundLinkData);
      }
    }

    if (rawData.forces) {
      for (const [idStr, forceData] of Object.entries(rawData.forces)) {
        newMechanism.addForce(Number(idStr), forceData);
      }
    }

    if (rawData.positions) {
      for (const [idStr, positionData] of Object.entries(rawData.positions)) {
        newMechanism.addPosition(Number(idStr), positionData);
      }
    }

    if (rawData.trajectories) {
      for (const [idStr, trajectoryData] of Object.entries(rawData.trajectories)) {
        newMechanism.addTrajectory(Number(idStr), trajectoryData);
      }
    }

    // 4) Store the newly constructed mechanism
    return newMechanism;
  }

    //todo also load globalUnits, globalUnitsSuffix, globalAngles, globalAnglesSuffix, and globalActivePanel
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
