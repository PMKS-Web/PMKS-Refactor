import {Action} from "../components/ToolBar/undo-redo-panel/action";
import {Coord} from "../model/coord";
import {Link} from "../model/link";
import {Joint} from "../model/joint";
import {Mechanism} from "../model/mechanism";
import {Subject} from "rxjs";
import { Injectable } from '@angular/core';
import {StateService} from "./state.service";

@Injectable({
  providedIn: 'root'
})

export class UndoRedoService {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxUndoSize = 2;

  private generateFourBarSubject = new Subject<void>();
  private generateSixBarSubject = new Subject<void>();

  private mechanism: Mechanism;
  constructor(private stateService: StateService) {
    this.mechanism = stateService.getMechanism();
  }

  // Records a new action for undo/redo functionality, merging similar consecutive actions when appropriate.
  public recordAction(action: Action): void {
    if (action.type === 'changeJointAngle') {
      const last = this.undoStack[this.undoStack.length - 1];
      if (
        last &&
        last.type === action.type &&
        last.linkId === action.linkId &&
        last.jointId === action.jointId
      ) {
        // Update the last action’s newAngle to the newest value
        (last as any).newAngle = (action as any).newAngle;
        return;
      }
    }

    if (this.undoStack.length >= this.maxUndoSize) {
      this.undoStack.shift();
    }
    this.undoStack.push(action);
    this.redoStack = [];
    console.log('Action recorded:', action);
  }

  // Returns whether there are actions available to undo.
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // Returns whether there are actions available to redo.
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Performs the undo operation by reverting the most recent action.
  public undo(): void {
    if (!this.canUndo()) {
      console.log('Nothing to undo');
      return;
    }
    const action = this.undoStack.pop()!;
    // Apply the inverse of the action.
    this.applyInverseAction(action);
    // Push the action onto the redo stack.
    this.redoStack.push(action);
    console.log('Undo performed for action:', action);
    this.mechanism.notifyChange();
  }

  // Performs the redo operation by reapplying the most recently undone action
  public redo(): void {
    if (!this.canRedo()) {
      console.log('Nothing to redo');
      return;
    }
    const action = this.redoStack.pop()!;
    // Reapply the original action.
    this.applyAction(action);
    // Push the action back onto the undo stack.
    this.undoStack.push(action);
    console.log('Redo performed for action:', action);
    this.mechanism.notifyChange();
  }
  //------------------------------------------------------------------------------------------------------
  //---------------------------------- | REDO | ----------------------------------------------------------
  //------------------------------------------------------------------------------------------------------
  // Applies an action to the Mechanism (redo logic).
  private applyAction(action: Action): void {
    switch (action.type) {
      case 'addInput':
        if (action.jointId !== undefined) {
          this.mechanism.addInput(action.jointId);
        }
        break;
      case 'removeInput':
        if (action.jointId !== undefined) {
          this.mechanism.removeInput(action.jointId);
        }
        break;
      case 'addGround':
        if (action.jointId !== undefined) {
          this.mechanism.addGround(action.jointId);
        }
        break;
      case 'removeGround':
        if (action.jointId !== undefined) {
          this.mechanism.removeGround(action.jointId);
        }
        break;
      case 'addSlider':
        if (action.jointId !== undefined) {
          this.mechanism.addSlider(action.jointId);
        }
        break;
      case 'removeSlider':
        if (action.jointId !== undefined) {
          this.mechanism.removeSlider(action.jointId);
        }
        break;
      case 'addWeld':
        if (action.jointId !== undefined) {
          this.mechanism.addWeld(action.jointId);
        }
        break;
      case 'removeWeld':
        if (action.jointId !== undefined) {
          this.mechanism.removeWeld(action.jointId);
        }
        break;
      case 'generateFourBar':
        this.generateFourBarSubject.next();
        break;
      case 'generateSixBar':
        this.generateSixBarSubject.next();
        break;
      case 'deleteJoint':
        if (action.jointId !== undefined) {
          this.mechanism.removeJoint(action.jointId);
        }
        break;
      case 'moveJoint':
        if (action.jointId != null && action.newCoords) {
          this.mechanism.setJointCoord(
            action.jointId,
            new Coord(action.newCoords.x, action.newCoords.y)
          );
        }
        break;
      case 'moveLink':
        for (const p of action.newJointPositions!) {
          this.mechanism.setJointCoord(
            p.jointId,
            new Coord(p.coords.x, p.coords.y)
          );
        }
        break;
      case 'addLink':
        if (action.extraJointsData) {
          action.extraJointsData.forEach((js) =>
            this.restoreJointFromSnapshot(js)
          );
        }
        //rebuild the link
        const ld = action.linkData!;
        const joints = ld.jointIds.map((id) => {
          const j = this.mechanism.getJoint(id);
          if (!j) console.warn(`addLink redo: missing joint ${id}`);
          return j!;
        });
        const newLink = new Link(ld.id, joints);
        newLink.name = ld.name;
        newLink.mass = ld.mass;
        newLink.angle = ld.angle;
        newLink.locked = ld.locked;
        newLink.color = ld.color;
        this.mechanism._addLink(newLink);
        break;
      case 'deleteLink':
        this.mechanism.removeLink(action.linkData!.id);
        break;
      case 'addTracer':
        const tr = action.linkTracerData!;
        this.mechanism.addJointToLink(
          tr.linkId,
          new Coord(tr.coords.x, tr.coords.y)
        );
        break;
      case 'addLinkToLink':
        this.mechanism.addLinkToLink(
          action.parentLinkId!,
          action.start!,
          action.end!
        );
        break;
      case 'setJoint':
        if (action.jointId != null && action.newCoords) {
          this.mechanism.setXCoord(action.jointId, action.newCoords.x);
          this.mechanism.setYCoord(action.jointId, action.newCoords.y);
        }
        break;
      case 'changeJointDistance': {
        const cd = action as any;
        const link = this.mechanism.getLink(cd.linkId!)!;
        const joint = this.mechanism.getJoint(cd.jointId!)!;
        link.setLength(cd.newDistance!, joint);
        break;
      }
      case 'changeJointAngle': {
        const ca = action as any;
        const link = this.mechanism.getLink(ca.linkId!)!;
        const joint = this.mechanism.getJoint(ca.jointId!)!;
        link.setAngle(ca.newAngle!, joint);
        break;
      }

      default:
        console.error('No inverse defined for action type:', action.type);
    }
  }
  //---------------------------------------------------------------------------------
  // --------------------------- | UNDO | ------------------------------------------
  //--------------------------------------------------------------------------------
  // Applies the inverse of an action to the Mechanism (undo logic).
  private applyInverseAction(action: Action): void {
    switch (action.type) {
      case 'addInput':
        if (action.jointId !== undefined) {
          this.mechanism.removeInput(action.jointId);
        }
        break;
      case 'removeInput':
        if (action.jointId !== undefined) {
          this.mechanism.addInput(action.jointId);
        }
        break;
      case 'addGround':
        if (action.jointId !== undefined) {
          this.mechanism.removeGround(action.jointId);
        }
        break;
      case 'removeGround':
        if (action.jointId !== undefined) {
          this.mechanism.addGround(action.jointId);
        }
        break;
      case 'generateFourBar':
        this.generateFourBarSubject.next();
        break;
      case 'generateSixBar':
        this.generateSixBarSubject.next();
        break;
      case 'addSlider':
        if (action.jointId !== undefined) {
          this.mechanism.removeSlider(action.jointId);
        }
        break;
      case 'removeSlider':
        if (action.jointId !== undefined) {
          this.mechanism.addSlider(action.jointId);
        }
        break;
      case 'addWeld':
        if (action.jointId !== undefined) {
          this.mechanism.removeWeld(action.jointId);
        }
        break;
      case 'removeWeld':
        if (action.jointId !== undefined) {
          this.mechanism.addWeld(action.jointId);
        }
        break;
      case 'deleteJoint':
        // Restore main joint:
        if (action.jointData) {
          this.restoreJointFromSnapshot(action.jointData);
        }
        // Restore extra (cascaded) joints:
        if (action.extraJointsData) {
          action.extraJointsData.forEach((jSnap) => {
            this.restoreJointFromSnapshot(jSnap);
          });
        }
        // Restore removed links:
        if (action.linksData) {
          action.linksData.forEach((linkSnap) => {
            const linkJoints = linkSnap.jointIds.map((jid) =>
              this.mechanism.getJoint(jid)
            );
            if (linkJoints.every((j) => j !== undefined)) {
              const restoredLink = new Link(linkSnap.id, linkJoints);
              restoredLink.name = linkSnap.name;
              restoredLink.mass = linkSnap.mass;
              restoredLink.angle = linkSnap.angle;
              restoredLink.locked = linkSnap.locked;
              restoredLink.color = linkSnap.color;
              this.mechanism._addLink(restoredLink);
            }
          });
        }
        break;
      case 'moveJoint':
        if (action.jointId != null && action.oldCoords) {
          this.mechanism.setJointCoord(
            action.jointId,
            new Coord(action.oldCoords.x, action.oldCoords.y)
          );
        }
        break;
      case 'moveLink':
        for (const p of action.oldJointPositions!) {
          this.mechanism.setJointCoord(
            p.jointId,
            new Coord(p.coords.x, p.coords.y)
          );
        }
        break;
      case 'addLink':
        this.mechanism.removeLink(action.linkData!.id);
        break;
      case 'deleteLink':
        if (action.extraJointsData) {
          action.extraJointsData.forEach((js) => {
            if (!this.mechanism.getJoint(js.id)) {
              this.restoreJointFromSnapshot(js);
            }
          });
        }
        // rebuild the link
        const ld = action.linkData!;
        const jointObjs = ld.jointIds.map((id) => {
          const j = this.mechanism.getJoint(id);
          if (!j) console.warn(`undo deleteLink: joint ${id} still missing`);
          return j!;
        });
        if (jointObjs.every((j) => j != null)) {
          const linkRestored = new Link(ld.id, jointObjs);
          linkRestored.name = ld.name;
          linkRestored.mass = ld.mass;
          linkRestored.angle = ld.angle;
          linkRestored.locked = ld.locked;
          linkRestored.color = ld.color;
          this.mechanism._addLink(linkRestored);
        }
        break;
      case 'addTracer': {
        const tr = action.linkTracerData!;
        const linkObj = this.mechanism.getLink(tr.linkId);
        const toRemove = Array.from(linkObj.joints.values()).find(
          (j) => j.coords.x === tr.coords.x && j.coords.y === tr.coords.y
        );
        if (toRemove) {
          this.mechanism.removeJoint(toRemove.id);
        } else {
          console.warn(
            `Undo addTracer: no tracer found at (${tr.coords.x},${tr.coords.y})`
          );
        }
        break;
      }
      case 'addLinkToLink':
        // remove the brand‑new link
        if (action.newLinkId !== undefined) {
          this.mechanism.removeLink(action.newLinkId);
        }
        if (action.attachJointId !== undefined) {
          this.mechanism.getJoint(action.attachJointId) &&
          this.mechanism.removeJoint(action.attachJointId);
        }
        break;
      case 'setJoint':
        if (action.jointId != null && action.oldCoords) {
          this.mechanism.setXCoord(action.jointId, action.oldCoords.x);
          this.mechanism.setYCoord(action.jointId, action.oldCoords.y);
        }
        break;
      case 'changeJointDistance': {
        const cd = action as any;
        const link = this.mechanism.getLink(cd.linkId!)!;
        const joint = this.mechanism.getJoint(cd.jointId!)!;
        link.setLength(cd.oldDistance!, joint);
        break;
      }
      case 'changeJointAngle': {
        const ca = action as any;
        const link = this.mechanism.getLink(ca.linkId!)!;
        const joint = this.mechanism.getJoint(ca.jointId!)!;
        link.setAngle(ca.oldAngle!, joint);
        break;
      }
      default:
        console.error('No inverse defined for action type:', action.type);
    }
  }

  // Restores a joint from its snapshot data when undoing a deletion.
  private restoreJointFromSnapshot(jointSnapshot: Action['jointData']): void {
    const restoredJoint = new Joint(
      jointSnapshot!.id,
      jointSnapshot!.coords.x,
      jointSnapshot!.coords.y
    );
    restoredJoint.name = jointSnapshot!.name;
    restoredJoint.type = jointSnapshot!.type;
    restoredJoint.angle = jointSnapshot!.angle;
    if (jointSnapshot!.isGrounded) restoredJoint.addGround();
    if (jointSnapshot!.isWelded) restoredJoint.addWeld();
    if (jointSnapshot!.isInput) restoredJoint.addInput();
    restoredJoint.speed = jointSnapshot!.inputSpeed;
    restoredJoint.locked = jointSnapshot!.locked;
    restoredJoint.hidden = jointSnapshot!.isHidden;
    restoredJoint.reference = jointSnapshot!.isReference;
    this.mechanism._addJoint(restoredJoint);
  }
}
