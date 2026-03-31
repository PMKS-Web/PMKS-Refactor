import { Action } from '../components/ToolBar/undo-redo-panel/action';
import { Coord } from '../model/coord';
import { Link } from '../model/link';
import { Joint } from '../model/joint';
import { Mechanism } from '../model/mechanism';
import { Subject } from 'rxjs';
import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { isUndefined } from 'lodash';
import { Position } from '../model/position';
import { Force } from '../model/force';
import {CompoundLink} from "../model/compound-link";

@Injectable({
  providedIn: 'root',
})
export class UndoRedoService {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxUndoSize = 2;

  private generateFourBarSubject = new Subject<void>();
  private generateSixBarSubject = new Subject<void>();
  private reinitializeSubject = new Subject<void>();
  public reinitialize$ = this.reinitializeSubject.asObservable();

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

  public getUndoStack(): Action[] {
    return [...this.undoStack];
  }
  public getRedoStack(): Action[] {
    return [...this.redoStack];
  }

  public clearStacks(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public restoreStacks(undoStack: Action[], redoStack: Action[]): void {
    this.undoStack = [...undoStack];
    this.redoStack = [...redoStack];
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
      case 'setSynthesisLength':
        this.mechanism.setCouplerLength(action.newDistance as number);
        break;
      case 'positionSpecified':
        this.mechanism.addPos(action.linkId as number);
        break;
      case 'addForce':
        if (!action.oldForce) return;
        this.mechanism._addForce(action.oldForce);
        action.oldForce.parentLink.addForce(action.oldForce);
        break;
      case 'deleteForce':
        if (!action.oldForce) return;
        this.mechanism.removeForce(action.oldForce.id);
        break;
      case 'moveForce':
        if (!action.newForce || !action.oldForce) return;
        this.mechanism.setForceStart(action.newForce.id, action.newForce.start);
        this.mechanism.setForceEnd(action.newForce.id, action.newForce.end);
        break;
      case 'deleteAllPositions':
        action.oldPositionArray?.forEach((pos) => {
          this.mechanism.removePosition(pos.id);
        });
        this.reinitializeSubject.next();
        break;
      case 'setPositionAngle':
        if (!isUndefined(action.linkId) && !isUndefined(action.newAngle)) {
          this.mechanism.setPositionAngle(action.newAngle, action.linkId);
        }
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
      case 'movePosition':
        for (const p of action.newJointPositions!) {
          this.mechanism.setJointCoord(
            p.jointId,
            new Coord(p.coords.x, p.coords.y)
          );
        }
        break;
      case 'setPositionPosition':
        this.mechanism.setPositionLocation(
          action.newCoords as Coord,
          action.linkId as number
        );
        break;
      case 'deletePosition':
        if (action.oldPosition) {
          this.mechanism.removePosition(action?.oldPosition.id);
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
          new Coord(tr.coords.x, tr.coords.y),
          true
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
      case 'lockLink': {
        //gets the linked specified from action
        const link = this.mechanism.getLink(action.linkId!)!;
        const locked = link.locked
        //reverses the lock
        link.locked = !locked
        break;
      } case 'circleLink': {
        //get the specified link from the action and see if it's a circle
        const link = this.mechanism.getLink(action.linkId!)!;
        const circular = link.isCircle;
        //reverse the lock
        link.isCircle = !circular
        break;
      } case 'deleteCompoundLink': {
        this.mechanism.removeCompoundLinkByID(action.compoundLinkData!.id);
        break;
      } case 'addTracerCompound': {
        const tr = action.linkTracerData!;
        this.mechanism.addTracerPointWelded(
          tr.linkId,
          tr.tracerModelPos!,
          tr.tracerSVGPos!,
        );
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
      case 'setSynthesisLength':
        this.mechanism.setCouplerLength(action.oldDistance as number);
        break;
      case 'deleteAllPositions':
        action.oldPositionArray?.forEach((pos) => {
          console.log('pos');
          console.log(pos);
          this.mechanism._addPositionSilent(pos);
          const joints = pos.getJoints();
          joints?.forEach((joint) => {
            this.mechanism._addJoint(joint);
          });
          this.reinitializeSubject.next();
        });
        break;
      case 'positionSpecified':
        this.mechanism.removePosition(action.linkId as number);
        break;
      case 'addForce':
        this.mechanism.removeForce(action.oldForce?.id as number);
        break;
      case 'moveForce':
        if (!action.newForce || !action.oldForce) return;
        this.mechanism.setForceStart(action.newForce.id, action.oldForce.start);
        this.mechanism.setForceEnd(action.newForce.id, action.oldForce.end);
        break;
      case 'deleteForce':
        if (!action.oldForce) return;
        this.mechanism._addForce(action.oldForce);
        action.oldForce.parentLink.addForce(action.oldForce);
        break;
      case 'setPositionAngle':
        if (!isUndefined(action.linkId) && !isUndefined(action.oldAngle)) {
          this.mechanism.setPositionAngle(action.oldAngle, action.linkId);
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
        // let weldedLink = undefined;
        // if (action.linksData) {
        //   action.linksData.forEach((link) => {
        //     if (weldedLink === undefined) {
        //       weldedLink = link;
        //     }
        //   })
        // }

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

        if (action.compoundLinkDataArray) {
          action.compoundLinkDataArray.forEach((cLinkSnap) => {
            const cLinks = cLinkSnap.linkIds.map((lid) =>
              this.mechanism.getLink(lid)
            );
            if (cLinks.every((l) => l !== undefined)) {
              const restoredCompoundLink = new CompoundLink(cLinkSnap.id, cLinks);
              restoredCompoundLink.name = cLinkSnap.name;
              restoredCompoundLink.mass = cLinkSnap.mass;
              restoredCompoundLink.lock = cLinkSnap.locked;
              restoredCompoundLink.color = cLinkSnap.color;
              this.mechanism._addCompoundLink(restoredCompoundLink);
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
      case 'movePosition':
        for (const p of action.oldJointPositions!) {
          this.mechanism.setJointCoord(
            p.jointId,
            new Coord(p.coords.x, p.coords.y)
          );
        }
        break;
      case 'setPositionPosition':
        this.mechanism.setPositionLocation(
          action.oldCoords as Coord,
          action.linkId as number
        );
        break;
      case 'deletePosition':
        const joints = action.oldPosition?.getJoints();
        this.mechanism._addPositionSilent(action.oldPosition as Position);
        joints?.forEach((joint) => {
          this.mechanism._addJoint(joint);
        });
        this.reinitializeSubject.next();
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
      case 'lockLink': {
        //get the specified link from the action and see if its locked
        const link = this.mechanism.getLink(action.linkId!)!;
        const locked = link.locked
        //reverse the lock
        link.locked = !locked
        break;
      }
      case 'circleLink': {
        //get the specified link from the action and see if it's a circle
        const link = this.mechanism.getLink(action.linkId!)!;
        const circular = link.isCircle
        //reverse the lock
        link.isCircle = !circular
        break;
      }
      case 'deleteCompoundLink': {
        // rebuilding joints
        if (action.compoundExtraJointsData) {
          action.compoundExtraJointsData!.forEach((joints) => {
            joints.forEach((j) => {
              if (!this.mechanism.getJoint(j.id)) {
                this.restoreJointFromSnapshot(j);
              }
            })
          })
        }

        // rebuilding links
        if (action.compoundExtraLinkData) {
          action.compoundExtraLinkData!.forEach((link) => {
            // check that joints exist
            const jointObjs = link.jointIds.map((id) => {
              const j = this.mechanism.getJoint(id);
              if (!j) console.warn(`undo deleteLink: joint ${id} still missing`);
              return j!;
            });

            if (jointObjs.every((j) => j != null)) {
              const linkRestored = new Link(link.id, jointObjs);
              linkRestored.name = link.name;
              linkRestored.mass = link.mass;
              linkRestored.angle = link.angle;
              linkRestored.locked = link.locked;
              linkRestored.color = link.color;
              this.mechanism._addLink(linkRestored);
            }
          })
        }

        // rebuilding compound link
        const cl = action.compoundLinkData!;
        const linkObjs = cl.linkIds.map((id) => {
          const l = this.mechanism.getLink(id);
          if (!l) console.warn(`undo deleteCompoundLink: link ${id} still missing`);
          return l!;
        });
        if (linkObjs.every((l) => l != null)) {
          const linkRestored = new CompoundLink(cl.id, linkObjs);
          linkRestored.name = cl.name;
          linkRestored.mass = cl.mass;
          linkRestored.lock = cl.locked;
          linkRestored.color = cl.color;
          this.mechanism._addCompoundLink(linkRestored);
        }

        break;
      }
      case 'addTracerCompound': {
        const tr = action.linkTracerData!;
        const allCompoundLinks = this.mechanism.getCompoundLinks();
        let linkObj;
        for (const c of allCompoundLinks) {
          if (c.id == tr.linkId) {
            linkObj = c;
          }
        }

        if (linkObj == undefined) {
          console.warn(
            `Undo addTracerCompound: no compound link found)`
          );
          break;
        }

        let allJoints: Joint[] = [];
        Array.from(linkObj!.links!.values()).forEach((l) => {
          Array.from(l.joints.values()).forEach((j) => {
            allJoints.push(j);
          })
        });

        const toRemove = allJoints.find(
          (j) => j.coords.x === tr.coords.x && j.coords.y === tr.coords.y
        );
        if (toRemove) {
          this.mechanism.removeJoint(toRemove.id);
        } else {
          console.warn(
            `Undo addTracerCompound: no tracer found at (${tr.coords.x},${tr.coords.y})`
          );
        }
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
    restoredJoint.isTracer = jointSnapshot!.isTracer;
    restoredJoint.isPartOfWelded = jointSnapshot!.isPartOfWelded;
    this.mechanism._addJoint(restoredJoint);
  }
}
