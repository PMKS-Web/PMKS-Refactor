import { Coord } from '../model/coord'
import { Joint } from '../model/joint'
import { Link, RigidBody } from '../model/link'
import { Force } from '../model/force'
import { CompoundLink } from '../model/compound-link'
import { BehaviorSubject } from 'rxjs'

export class Mechanism {
    private _joints: Map<number, Joint>;
    private _links: Map<number,Link>;
    private _forces: Map<number, Force>;
    private _compoundLinks: Map<number, CompoundLink>;
    private _idCount: number;
    private _jointIDCount: number;
    private _linkIDCount: number;
    private _forceIDCount: number;
    private _compoundLinkIDCount: number;
    private _mechanismChange: BehaviorSubject<Mechanism> = new BehaviorSubject<Mechanism>(this);
    public _mechanismChange$ = this._mechanismChange.asObservable();

    constructor() {
        this._joints = new Map();
        this._links = new Map();
        this._forces = new Map();
        this._compoundLinks = new Map();
        this._idCount = 0;
        this._jointIDCount = 0;
        this._linkIDCount = 0;
        this._forceIDCount = 0;
        this._compoundLinkIDCount = 0;
        
    }

    notifyChange(): void{
        console.log("updated Mechanism to");
        console.log(Array.from(this._joints.values()));
        this._mechanismChange.next(this);
    }


    //----------------------------GRID CONTEXT MENU ACTIONS----------------------------

    /**
     * Given two Coordinates, generates two joints at those coordinates and makes a link between them
     * TODO: Account for two additional cases,
     * 1. from grid to joint
     * 2. from grid to link
     * @param {Coord} coordOne
     * @param {Coord} coordTwo
     * @memberof Mechanism
     */
    addLink(coordOne: Coord, coordTwo: Coord) {
        let jointA = new Joint(this._jointIDCount, coordOne);
        this._jointIDCount++;
        let jointB = new Joint(this._jointIDCount, coordTwo);
        this._jointIDCount++;
        this._joints.set(jointA.id, jointA);
        this._joints.set(jointB.id, jointB);
        let linkA = new Link(this._linkIDCount, [jointA,jointB]);
        this._linkIDCount++;
        this._links.set(linkA.id, linkA);
        this.notifyChange();
        //console.log(this);
    }

    //----------------------------JOINT CONTEXT MENU ACTIONS----------------------------


    /**
     * Generalized function for performing actions/modifications on joints,
     * 1. Checks the jointID is valid.
     * 2. Checks the requested action can be performed on the joint(a Joint class function)
     * 3. Attempts to perform the action on the joint(another Joint class function)
     * Outline: this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{});
     * @private
     * @param {number} jointID
     * @param {(joint: any) => boolean} canPerformAction
     * @param {string} errorMsg
     * @param {string} successMsg
     * @param {(joint: any) => void} action
     * @return {*}
     * @memberof Mechanism
     */
    private executeJointAction(jointID: number, canPerformAction: (joint: Joint) => boolean, errorMsg: string, successMsg: string, action: (joint: any) => void): boolean {
        let joint = this._joints.get(jointID);
        if (joint === undefined) {
            console.error(`Joint with ID ${jointID} does not exist`);
            return false;
        }
        if (!canPerformAction(joint)) {
            console.error(`Joint with ID ${jointID} ${errorMsg}`);
            return false;
        }
        if(joint.locked && successMsg !== 'unwelded'){
            console.error(`Joint with ID ${jointID} is locked`)
            return false;
        }

        try {
            action(joint);
            //console.log(`Joint with ID ${jointID} ${successMsg}`);
            this.notifyChange();
            //console.log(this);
            return true;
        } catch (error: any) {
            console.error(`An error occurred when trying to ${errorMsg} joint ${jointID}: ${error.message}`);
            return false;
        }
    }

    /**
     * Given a joint's ID, welds all links attached to that joint into a single compound link, and sets the joint to welded.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    addWeld(jointID: number) {
        this.executeJointAction(jointID,  joint => this.canAddWeld(joint), 'cannot become welded', 'successfully welded', joint => {
            joint.addWeld();
            //cascade effects into affected links, compound links,
            let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
            let connectedCompoundLinks: CompoundLink[] = this.getConnectedCompoundLinks(joint);


            //if not connected to any links do nothing
            if(connectedLinks.length == 0){
                return;

            //if not already part of a CompoundLink create a new one and add all connected links
            } else if(connectedCompoundLinks.length == 0){
                let compoundLink: CompoundLink = new CompoundLink(this._compoundLinkIDCount,connectedLinks);
                this._compoundLinkIDCount++;
                this._compoundLinks.set(compoundLink.id,compoundLink);
                compoundLink
            //if part of one or more compoundLink, combine them and add any other existing links
            } else if(connectedCompoundLinks.length >= 1){
                for(let compoundLink of connectedCompoundLinks){
                    //add all links from connected compoundlinks to connectedLinks array
                    for(let link of compoundLink.links.values()){
                        if(!connectedLinks.includes(link))
                        connectedLinks.push(link);
                    }
                //remove compound link to avoid duplicates
                this._compoundLinks.delete(compoundLink.id);
                }
                //create a new compoundlink containing all of the links that should be connected.
                let compoundLink: CompoundLink = new CompoundLink(this._compoundLinkIDCount,connectedLinks);
                this._compoundLinkIDCount++;
                this._compoundLinks.set(compoundLink.id,compoundLink);
            }
        });
    }
    /**
     * Given a joint's ID, unwelds all links attached to that joint, and sets the joint to unwelded.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    removeWeld(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canRemoveWeld(), 'cannot become unwelded', 'unwelded', joint => {
            joint.removeWeld();
            //cascade effects into affected links, compound links, and forces
            let connectedCompoundLinks: CompoundLink[] = this.getConnectedCompoundLinks(joint);


            for(let compoundLink of connectedCompoundLinks){
                console.log("compound links being checked")
                let newCompoundLinks: CompoundLink[] = compoundLink.compoundLinkAfterRemoveWeld(joint, this._compoundLinkIDCount);
                this._compoundLinks.delete(compoundLink.id);

                // Unlock every link that isn't part of a compound link
                this.unlockNonCompoundLinks();

                for(let link of newCompoundLinks){
                    this._compoundLinks.set(link.id,link);
                    this._compoundLinkIDCount++;
                }
            }
        });
    }

  private unlockNonCompoundLinks(): void {
    for (let link of this._links.values()) {
      let isPartOfCompoundLink = Array.from(
        this._compoundLinks.values()).some(compoundLink => compoundLink.links.has(link.id));
      console.log("Unlocking non-compound link:" + link.name);
      if (!isPartOfCompoundLink) {
        console.log("Link is not part of compound: " + link.name);
        link.locked=false;
      }
    }
  }
    /**
     *  Given a joint's ID, turns the joint into a prismatic-revolute joint with a slider and angle.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    addSlider(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canAddSlider(), 'cannot become prismatic', 'slider added successfully', joint => joint.addSlider());
    }
    /**
     * Given a joint's ID, turns the joint into a revolute joint, removing the slider and angle.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    removeSlider(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canRemoveSlider(), 'cannot become revolute', 'slider removed successfully', joint => joint.removeSlider());
    }
    /**
     * Given a joint's ID, attempts to make the joint a ground.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    addGround(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canAddGround(), 'cannot become grounded', 'grounded successfully', joint => joint.addGround());
    }
    /**
     * Given a joint's ID, attempts to remove the ground from the joint.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    removeGround(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canRemoveGround(), 'cannot become ungrounded', 'ungrounded successfully', joint => joint.removeGround());
    }
    /**
     * Given a joint's ID, attempts to add an input to the joint.
     * TODO: Account for the case in which the joint is already connected to an input through a series of links.
     * @param {number} jointID
     * @memberof Mechanism
     */
    addInput(jointID: number) {
        //before this, check if mechanism already has an input.
        this.executeJointAction(jointID, joint => joint.canAddInput(), 'cannot become an input', 'input added successfully', joint => joint.addInput());
    }
    /**
     * Given a joint's ID, attempts to remove the input from the joint.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    removeInput(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canRemoveInput(), 'cannot have its input removed', 'input removed successfully', joint => joint.removeInput());
    }


    lockJoint(jointID: number) {
        this.executeJointAction(jointID, joint => joint.canLock(), 'cannot be locked', 'successfully locked', joint => joint.addLock());
    }
    unlockJoint(joint: Joint) {
        joint.breakLock();
    }

    /**
     * Given a joint's ID, and a Coordinate, creates a new joint with the coordinate, and a new Link containing the passed Joint, and the new joint.
     * TODO: Account for creating a link between two joints
     * @param {number} jointID
     * @param {Coord} coordOne
     * @memberof Mechanism
     */
    addLinkToJoint(jointID: number, coordOneORJointID: Coord | number) {

        this.executeJointAction(jointID, (joint) => true, 'cannot have a new link added','has had a new link added', (joint) =>{
            let jointB: Joint;
            if(typeof coordOneORJointID !== 'number'){
                jointB = new Joint(this._jointIDCount, coordOneORJointID);
                this._jointIDCount++;
            }else if(this._joints.has(coordOneORJointID)){
                jointB = this._joints.get(coordOneORJointID)!;
            }else{
                return;
            }
            this._joints.set(jointB.id, jointB);
            let linkA = new Link(this._linkIDCount, joint, jointB);
            this._linkIDCount++;
            this._links.set(linkA.id, linkA);
        });
    }

    /**
     * Given a joint's ID, deletes the joint from the mechanism, as well as updates all links, and compound links to reflect the change.
     *
     * @param {number} jointID
     * @memberof Mechanism
     */
    removeJoint(jointID: number) {
        this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{
            //perform deletion, need helper functions to handle links(and their forces), and compound links.

            for(let link of this._links.values()){
                if(link.containsJoint(joint.id)){
                    try{
                        link.removeJoint(joint.id);
                    }catch (error: any){
                        //only error thrown here is when the link now only has 1 joint and must be deleted.
                        this.removeLink(link.id);
                    }
                }
            }
            this._joints.delete(joint.id);
        });
    }
    //----------------------------JOINT CONTEXT MENU ACTIONS VERIFIERS----------------------------

    canAddInput(joint: Joint): boolean{
        //check if the joint knows it can be an input
        if(!joint.canAddInput())
            return false;

        let numberOfEffectiveConnectedLinks = this.getNumberOfEffectiveConnectedLinksForJoint(joint)
        //If a revolute grounded joint is connected to more than one link and isn't welded to all of them it cannot be an input.
        if(joint.isGrounded && numberOfEffectiveConnectedLinks > 1)
            return false;
        return true;
    }
    canRemoveInput(joint: Joint): boolean{
        return joint.canRemoveInput();
    }
    canAddGround(joint: Joint): boolean{
        return joint.canAddGround()
    }
    canRemoveGround(joint: Joint): boolean{
        return joint.canRemoveGround()
    }

    canAddWeld(joint: Joint): boolean{
        let count = 0;
        for(let link of this._links.values()){
            if(link.containsJoint(joint))
                count++;
        }
        return count>=2;
    }
    canRemoveWeld(joint: Joint): boolean{
        return joint.canRemoveWeld()
    }
    canAddSlider(joint: Joint): boolean{
        return joint.canAddSlider()
    }
    canRemoveSlider(joint: Joint): boolean{
        return joint.canRemoveSlider()
    }
    canLock(joint: Joint): boolean{
        return joint.canLock()
    }
    canUnlock(joint: Joint): boolean{
        return joint.canUnlock()
    }

    //----------------------------JOINT EDIT MENU ACTIONS----------------------------
    /**
     * Changes the name of a Joint given its ID and new name.
     *
     * @param {number} jointID
     * @param {string} newName
     * @memberof Mechanism
     */
    setJointName(jointID: number, newName: string) {
        this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{joint.name = newName;});
    }
    /**
     * Moves a joint to a new specified x coordinate.
     *
     * @param {number} jointID
     * @param {number} newXCoord
     * @memberof Mechanism
     */
    setJointCoord(jointID: number, newCoord: Coord) {
        this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{joint.setCoordinates(newCoord);});
    }
    /**
     * Moves a joint to a new specified x coordinate.
     *
     * @param {number} jointID
     * @param {number} newXCoord
     * @memberof Mechanism
     */
    setXCoord(jointID: number, newXCoord: number) {
        this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{joint.coords.x = newXCoord;});
    }

    /**
     *Moves a joint to a new specified y coordinate.
     *
     * @param {number} jointID
     * @param {number} newYCoord
     * @memberof Mechanism
     */
    setYCoord(jointID: number, newYCoord: number) {
        this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{joint.coords.y = newYCoord});

    }
    /**
     * Given two joints and a desired length between them, moves the first joint along the line which passes between both joints(maintains angle) to a position that satisfies the length
     *
     * @param {number} jointIDtoChange
     * @param {number} jointIDReference
     * @param {number} newDistance
     * @memberof Mechanism
     */
    setDistanceToJoint(jointIDtoChange: number, jointIDReference: number, newDistance: number) {
        let jointB = this._joints.get(jointIDReference);
        if( jointB === undefined){
            console.error(`Joint with ID ${jointIDReference} does not exist`);
            return;
        }
        this.executeJointAction(jointIDtoChange, (joint) => true, 'error','success', (joint) =>{joint.setDistancetoJoint(newDistance, jointB);});
    }
    /**
     * Given two joints and a desired angle between them, rotates the first joint around the second(mantaining same distance) until the desired angle is reached.
     *
     * @param {number} jointIDtoChance
     * @param {number} jointIDReference
     * @param {nnumber} newAngle
     * @memberof Mechanism
     */
    setAngleToJoint(jointIDtoChange: number, jointIDReference: number, newAngle: number) {
        let jointB = this._joints.get(jointIDReference);
        if(jointB === undefined){
            console.error(`Joint with ID ${jointIDReference} does not exist`);;
            return;
        }
        this.executeJointAction(jointIDtoChange, (joint) => true, 'error','success',
        (joint) =>{joint.setAngletoJoint(newAngle, jointB);});
    }




    //----------------------------LINK CONTEXT MENU ACTIONS----------------------------
        /**
     * Higher Order function that performs all available actions on links
     * 1. Checks the linkID is valid and gets the link to change
     * 2. Attempts to perform the modification to the link based on the passed function.
     * Outline: this.executeLinkAction(linkID, link => {});
     * @private
     * @param {number} linkID
     * @param {(link: Link) => void} action
     * @return {*}
     * @memberof Mechanism
     */
    private executeLinkAction(linkID: number, action: (link: Link) => void) {
        let link = this._links.get(linkID);
        if (link === undefined) {
            console.error(`Link with ID ${linkID} does not exist`);
            return;
        }
        action(link);
        this.notifyChange();
        //console.log(this);
    }

    /**
     * attaches a tracer point(effectively a joint) to a an existing link.
     *
     * @param {number} linkID
     * @param {Coord} coord
     * @memberof Mechanism
     */
    addJointToLink(linkID: number, coord: Coord) {
        this.executeLinkAction(linkID, link => {
            let jointA = new Joint(this._jointIDCount, coord);
            this._jointIDCount++;
            this._joints.set(jointA.id, jointA);
            link.addTracer(jointA);
        });
    }
    /**
     * attaches a new link to another link at a point along the existing link which is not a joint.
     *
     * @param {number} linkID
     * @param {Coord} startCoord
     * @param {Coord} endCoord
     * @memberof Mechanism
     */
    addLinkToLink(linkID: number, startCoord: Coord, endCoord: Coord) {
        this.executeLinkAction(linkID, link => {
            //create new joints and link
            let jointA = new Joint(this._jointIDCount, startCoord);
            this._jointIDCount++;
            let jointB = new Joint(this._jointIDCount, endCoord);
            this._jointIDCount++;
            let linkB = new Link(this._linkIDCount,jointA, jointB);
            this._linkIDCount++;
            //add new joints and links to mechanism
            this._joints.set(jointA.id, jointA);
            this._joints.set(jointB.id,jointB);
            this._links.set(linkB.id,linkB);
            //attach links
            link.addTracer(jointA);
        });
    }
    /**
     *attaches a force to a an existing link.
     *
     * @param {number} linkID
     * @param {Coord} startCoord
     * @param {Coord} endCoord
     * @memberof Mechanism
     */
    addForceToLink(linkID: number, startCoord: Coord, endCoord: Coord) {
        this.executeLinkAction(linkID, link => {
            let forceA = new Force(this._forceIDCount,startCoord,endCoord);
            this._forceIDCount++;
            this._forces.set(forceA.id, forceA);
            link.addForce(forceA);
        });
    }
    /**
     * deletes a link from the mechanism, and cascades this deletion into affected forces, joints, and compound links.
     *
     * @param {number} linkID
     * @memberof Mechanism
     */
    removeLink(linkID: number) {
        this.executeLinkAction(linkID, link => {
            //Delete all forces associated with this link.
            this.removeLinkCascadeForces(link);
            //If this link is the only link associated with a joint, delete it.
            this.removeLinkCascadeJoints(link);
            //If this link is part of any compound link, the compound link must be readjusted
            this.removeLinkCascadeCompoundLinks(link);
            this._links.delete(link.id);
        });
    }
    //----------------------------LINK HELPERS----------------------------
    private removeLinkCascadeForces(link: Link){
        for(let forceID of link.forces.keys()){
            link.removeForce(forceID);
            this._forces.delete(forceID);
        }
    }
    private removeLinkCascadeJoints(link: Link){
        for(let joint of link.joints.values()){
            let isIsolated = true;//assume joint is isolated initially

            //check if joint is part of any other link
            for(let alink of this._links.values()){
                if(alink.id !== link.id && alink.containsJoint(joint.id)){
                    isIsolated = false;//joint isn't isolated, move to next joint
                    break;
                }
            }
            //Delete isolated joint
            if(isIsolated){
                this._joints.delete(joint.id);
            }
        }
    }

    // first removes every link within the compound link, then the compound link itself
    public removeCompoundLink (compoundLink: CompoundLink) {
      for(let link of compoundLink.links.values()) {
        this.removeLink(link.id);
      }
      this._compoundLinks.delete(compoundLink.id);
    }

    private removeLinkCascadeCompoundLinks(link: Link){
        let compoundLink: CompoundLink | undefined;
        compoundLink = undefined;
        //find the compound link this link is a part of if there is one
        for(let compound of this._compoundLinks.values()){
            if(compound.containsLink(link.id)){
                compoundLink = compound;
                break;
            }
        }
        if(compoundLink === undefined)
            return;
        try{
            compoundLink.removeLink(link);
        }catch(error){
            //This means the compound link only has one link in it after the deletion. ie it shouldn't exist anymore
            this._compoundLinks.delete(compoundLink.id);
        }

    }

    //----------------------------LINK EDIT MENU ACTIONS----------------------------
    /**
     * Sets the name of a link given its ID.
     *
     * @param {number} linkID
     * @param {string} newName
     * @memberof Mechanism
     */
    setLinkName(linkID: number, newName: string) {
        this.executeLinkAction(linkID, link => {link.name = newName;});
    }
    /**
     * Sets the length of a link given its ID.
     *
     * @param {number} linkID
     * @param {number} newLength
     * @memberof Mechanism
     */
    /*
    setLinkLength(linkID: number, newLength: number) {
        this.executeLinkAction(linkID, link => {link.setLength(newLength);});
    }
     */
    /**
     * Sets the angle of a link relative to the x axis, while maintaining its length given its ID.
     *
     * @param {number} linkID
     * @param {number} newAngle
     * @memberof Mechanism
     */
    /*
    setLinkAngle(linkID: number, newAngle: number) {
        this.executeLinkAction(linkID, link => {link.setAngle(newAngle, refJoint);});
    }
     */
    /**
     * Changes the mass of a specified Link
     *
     * @param {number} linkID
     * @param {number} newMass
     * @memberof Mechanism
     */
    setLinkMass(linkID: number, newMass: number) {
        this.executeLinkAction(linkID, link => {link.mass = newMass;});
    }
    //----------------------------FORCE CONTEXT MENU ACTIONS----------------------------


    /**
     * Higher Order function that performs all available actions on forces
     * 1. Checks the forceID is valid and gets the force to change
     * 2. Attempts to perform the modification to the force based on the passed function.
     *
     * @private
     * @param {number} forceID
     * @param {(force: Force) => void} action
     * @return {*}
     * @memberof Mechanism
     */
    private executeForceAction(forceID: number, action: (force: Force) => void) {
        let force = this._forces.get(forceID);
        if (force === undefined) {
            console.error(`Force with ID ${forceID} does not exist`);
            return;
        }
        action(force);
        this.notifyChange();
        //console.log(this);
    }

    /**
     * Rotates a force 180 degrees to be pointed in the opposite direction.
     *
     * @param {number} forceID
     * @memberof Mechanism
     */
    switchForceDirection(forceID: number) {
        this.executeForceAction(forceID, force => force.switchForceDirection());
    }
    /**
     * Changes the frame of reference of the force, either local to the link which it is attached, or global, acting on all forces.
     *
     * @param {number} forceID
     * @memberof Mechanism
     */
    changeForceFrame(forceID: number) {
        this.executeForceAction(forceID, force => force.changeFrameOfReference());
    }
    /**
     * Deletes a force from the mechanism and from the link it was associated with.
     *
     * @param {number} forceID
     * @memberof Mechanism
     */
    removeForce(forceID: number) {
        this.executeForceAction(forceID, force => {
            for (let link of this._links.values()) {
                if (link.containsForce(forceID)) {
                    link.removeForce(forceID);
                }
            }
            this._forces.delete(forceID);
        });
    }

    //----------------------------FORCE EDIT MENU ACTIONS----------------------------
    /**
     *Sets the name of a force given its ID.
     *
     * @param {number} forceID
     * @param {string} newName
     * @memberof Mechanism
     */
    setForceName(forceID: number, newName: string) {
        this.executeForceAction(forceID, force => force.name = newName);
    }
    /**
     * Sets the magnitude of a force given its ID.
     *
     * @param {number} forceID
     * @param {number} newMagnitude
     * @memberof Mechanism
     */
    setForceMagnitude(forceID: number, newMagnitude: number) {
        this.executeForceAction(forceID, force => force.magnitude = newMagnitude);
    }
    /**
     * Sets the x component(not be confused with individual coordinates) of a force given its ID by changing its end coordinate.
     *
     * @param {number} forceID
     * @param {number} newXComp
     * @memberof Mechanism
     */
    setForceXComp(forceID: number, newXComp: number) {
        this.executeForceAction(forceID, force => force.setXComp(newXComp));
    }
    /**
     *Sets the y component(not be confused with individual coordinates) of a force given its ID by changing its end coordinate.
     *
     * @param {number} forceID
     * @param {number} newYComp
     * @memberof Mechanism
     */
    setForceYComp(forceID: number, newYComp: number) {
        this.executeForceAction(forceID, force => force.setYComp(newYComp));
    }
    /**
     * Sets the angle of a force relative to the x axis while maintaining its length given its ID.
     *
     * @param {number} forceID
     * @param {number} newAngle
     * @memberof Mechanism
     */
    setForceAngle(forceID: number, newAngle: number) {
        this.executeForceAction(forceID, force => force.setForceAngle(newAngle));
    }

    //----------------------------HELPER FUNCTIONS----------------------------

    getConnectedLinksForJoint(joint: Joint): Link[]{
    let connectedLinks: Link[] = [];
    for(let link of this._links.values()){
        if(link.containsJoint(joint.id)){
            connectedLinks.push(link);
        }}
        return connectedLinks;
    }
    private getConnectedCompoundLinks(joint: Joint): CompoundLink[]{
        let connectedCompoundLinks: CompoundLink[] = [];
        for(let link of this._compoundLinks.values()){
            if(link.containsJoint(joint.id)){
                connectedCompoundLinks.push(link);
            }}
        return connectedCompoundLinks;
    }
    private getNumberOfEffectiveConnectedLinksForJoint(joint: Joint): number{
        let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
        let connectedCompoundLinks: CompoundLink[] = this.getConnectedCompoundLinks(joint)
        let numberOfConnectedCompoundLinks: number = connectedCompoundLinks.length.valueOf();
        let numberOfConnectedLinks: number = connectedLinks.length.valueOf();
        let duplicates: number = 0;
        for(let compoundLink of connectedCompoundLinks){
            for(let link of compoundLink.links.values()){
                if(link.containsJoint(joint.id))
                    duplicates++;
            }
        }
        return (numberOfConnectedLinks - duplicates) + numberOfConnectedCompoundLinks;
    }
    private getEffectiveConnectedLinksForJoint(joint: Joint): RigidBody[] {
        let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
        let connectedCompoundLinks: CompoundLink[] = this.getConnectedCompoundLinks(joint);

        for (let compoundLink of connectedCompoundLinks) {
            for (let link of compoundLink.links.values()) {
                connectedLinks = connectedLinks.filter(connectedLink => connectedLink.id !== link.id);
            }
        }
        return [...connectedLinks, ...connectedCompoundLinks] as RigidBody[];
    }

    //----------------------------GET FUNCTIONS----------------------------
    getJoint(id: number): Joint {
        return this._joints.get(id)!;
    }



    getJoints(): IterableIterator<Joint>{
        return this._joints.values();
    }
    getIndependentLinks(): IterableIterator<Link>{
        let allLinks: Map<number,Link> = new Map();
        for(let [id,link] of this._links){
            allLinks.set(id,link);
        }
        for(let compound of this._compoundLinks.values()){
            for(let linkID of compound.links.keys()){
                allLinks.delete(linkID);
            }
        }
        return allLinks.values();
    }

    getCompoundLinks(): IterableIterator<CompoundLink>{
        return this._compoundLinks.values();
    }
    getForces(): IterableIterator<Force>{
        return this._forces.values();
    }
 //----------------------------GET FUNCTIONS FOR KINEMATICS----------------------------
    getSubMechanisms(): Array<Map<Joint,RigidBody[]>>{
        const subMechanisms: Array<Map<Joint,RigidBody[]>> = new Array();
        const visitedJoints: Set<Joint> = new Set();
        const sublinkIndex: number = 0;
        for(let joint of this._joints.values()){
            if(!visitedJoints.has(joint)){
                const subMechanism: Map<Joint,RigidBody[]> = new Map();
                this.connectedJointsDFS(joint,visitedJoints,subMechanism);
                subMechanisms.push(subMechanism);
            }

        }


        return subMechanisms;
    }

    private connectedJointsDFS(joint: Joint, visited: Set<Joint>,subMechanism: Map<Joint,RigidBody[]>){
        visited.add(joint);

        subMechanism.set(joint,this.getEffectiveConnectedLinksForJoint(joint));
        subMechanism.get(joint)?.forEach(link =>{
            for(let connectedJoint of link.getJoints())
            if(!visited.has(connectedJoint)){
                this.connectedJointsDFS(connectedJoint,visited,subMechanism);
            }
        })

    }




}
