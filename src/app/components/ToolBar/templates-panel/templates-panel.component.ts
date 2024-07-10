import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { Mechanism } from 'src/app/model/mechanism';
import { Coord } from 'src/app/model/coord';
import { Joint } from 'src/app/model/joint';
import { Link } from 'src/app/model/link';
import { StateService } from 'src/app/services/state.service';
import { state } from '@angular/animations';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
//import {window} from "rxjs";


@Component({
  selector: 'app-templates-panel',
  templateUrl: './templates-panel.component.html',
  styleUrls: ['./templates-panel.component.scss'],

})
export class TemplatesPanelComponent {

  private mechanism: Mechanism;
  public open = true;

  constructor(private interactionService: InteractionService, private stateService: StateService){
    //creates a new mechanism in the state
    this.mechanism = this.stateService.getMechanism();
  }
  togglePanel() {
    this.open = false;
  }

  openTemplate(linkage: string){
    this.open=false; //closes panel sort of, will need a better fix to actually close the panel in the toolbar

    //calls helper functions to call to the state and create the mechanisms by calling to the mechanism class
    //these functions are temporary solutions, in the future should be done using encoding
    // const protocol = window.location.protocol;
    // const hostname = window.location.hostname;
    // const pathname = window.location.pathname;
    // const port = window.location.port;
    // const url = `${protocol}//${hostname}${port ? `:${port}` : ''}${pathname}`;
    // const dataURLString = `${url}?${content}`;
    //
    // const toolman = document.createElement('a');
    // toolman.setAttribute('href', dataURLString);
    // toolman.setAttribute('target', '_blank');
    // toolman.style.display = 'none';
    // document.body.appendChild(toolman);
    // toolman.click();
    // document.body.removeChild(toolman);


    if(linkage==='fourbar'){
      this.makeFourBar();
    }
    else if(linkage==='watt'){
      this.makeWatt();
    }
    else if(linkage==='watt2'){
      this.makeWatt2();
    }
    else if(linkage==='steph3'){
      this.makeSteph3();
    }
    else if(linkage==='slider'){
      this.makeSlider();
    }
  }

  makeFourBar(){
    //these are all of the joints used in the four bar, referenced later
    let joint1 = new Coord(-3.13,-2.01);
    let joint2 = new Coord(-2.62,.9);
    let joint3 = new Coord(3.01,2.08);
    let joint4 = new Coord(3.34,-1.65);

    this.mechanism.addLink(joint1, joint2);

    let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
    let lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3);
    }

    joints=this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint4);
    }

    //adds the grounded joints and input
    joints=this.mechanism.getJoints();
    for (const joint of joints) {
      if(joint.id===0){
        joint.addGround();
        joint.addInput();
      }
      if(joint.id===3){
        joint.addGround();
      }
    }

    console.log(this.mechanism);
  }



  makeWatt(){
    //these are all of the joints used in the watt1linkage, referenced later
    let joint1 = new Coord(-1.71, -1.33);
    let joint2 = new Coord(-2.56, .62);
    let joint3 = new Coord(-1.03,3.56);
    let tracer1 = new Coord(2.4,1.36);
    let joint4 = new Coord(7.54,-2.62);
    let tracer2 = new Coord(7.19, 5.18);
    let joint5 = new Coord(1.99,8.13);


    this.mechanism.addLink(joint1, joint2);

    let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
    let lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    let joint3Id= lastJoint?.id;

    let links = this.mechanism.getIndependentLinks(); //makes a list of all the links in the mechanism
    let lastLink  = this.getLastLink(links);
    if (lastLink !== undefined) {
      this.mechanism.addJointToLink(lastLink.id, tracer1);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint4);
    }

    links = this.mechanism.getIndependentLinks(); //updates list of all links
    lastLink  = this.getLastLink(links);
    if (lastLink !== undefined) {
      this.mechanism.addJointToLink(lastLink.id, tracer2);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint5);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined && joint3Id!==undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3Id);
    }


    //adds the grounded joints and input
    joints=this.mechanism.getJoints();
    for (const joint of joints) {
      if(joint.id===0){
        joint.addGround();
        joint.addInput();
      }
      if(joint.id===4){
        joint.addGround();
      }
    }

    console.log(this.mechanism);
  }

  makeWatt2(){
    //these are all of the joints used in the watt2linkage, referenced later
    let joint1 = new Coord(-3,-2);
    let joint2 = new Coord(-3,-.5);
    let joint3 = new Coord(-.5,1.5);
    let joint4 = new Coord(5.5, 1.2);
    let tracer1 = new Coord(3.5,-2);
    let joint5 = new Coord(11, 1.2);
    let joint6 = new Coord(11.25, -2.3);

    this.mechanism.addLink(joint1, joint2);

    let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
    let lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint4);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);

    let links = this.mechanism.getIndependentLinks(); //makes a list of all the links in the mechanism
    let lastLink  = this.getLastLink(links);
    if (lastLink !== undefined) {
      this.mechanism.addJointToLink(lastLink.id, tracer1);
    }

    //doesn't update last joint so it doesn't add a link to the tracer point
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint5);
    }

    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint6);
    }

    //adds the grounded joints and input
    joints=this.mechanism.getJoints();
    for (const joint of joints) {
      if(joint.id===4){
        joint.addGround();
        joint.addInput();
      }
      if(joint.id===0 || joint.id===6){
        joint.addGround();
      }
    }

    console.log(this.mechanism);
  }

  makeSteph3(){
    //these are all of the joints used in the steph3linkage, referenced later
    let joint1 = new Coord(-2.2,-2.47);
    let joint2 = new Coord(-2.46,-.98);
    let joint3 = new Coord(3,.13);
    let tracer1 = new Coord(-.2, .9);
    let joint4 = new Coord(3.26,-1.92);
    let joint5 = new Coord(.87,3.18);
    let joint6 = new Coord(5.5,1.04);

    this.mechanism.addLink(joint1, joint2);

    let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
    let lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3);
    }
    let links = this.mechanism.getIndependentLinks(); //makes a list of all the links in the mechanism
    joints = this.mechanism.getJoints(); //updates list of all joints
    lastJoint= this.getLastJoint(joints);
    let lastLink  = this.getLastLink(links);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint4);
    }

    //let lastLink  = this.getLastLink(links);
    if (lastLink !== undefined) {
      this.mechanism.addJointToLink(lastLink.id, tracer1);
    }

    joints = this.mechanism.getJoints();
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint5);
    }

    joints = this.mechanism.getJoints();
    lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint6);
    }

    //adds the grounded joints and input
    joints=this.mechanism.getJoints();
    for (const joint of joints) {
      if(joint.id===0){
        joint.addGround();
        joint.addInput();
      }
      if(joint.id===3 || joint.id===6){
        joint.addGround();
      }
    }

    console.log(this.mechanism);
  }

  makeSlider(){
    //these are all of the joints used in the sliderlinkage, referenced later
    let joint1 = new Coord(-3,0);
    let joint2 = new Coord(-2.5,2.5);
    let joint3 = new Coord(3,1);

    this.mechanism.addLink(joint1, joint2);
    let joints = this.mechanism.getJoints();
    let lastJoint= this.getLastJoint(joints);
    if (lastJoint !== undefined) {
      this.mechanism.addLinkToJoint(lastJoint.id, joint3);
    }

    //adds the grounded joints and input and slider
    joints=this.mechanism.getJoints();
    for (const joint of joints) {
      if(joint.id===0){
        joint.addGround();
        joint.addInput();
      }
      if(joint.id===2){
        joint.addSlider();
      }
    }
    console.log(this.mechanism);
  }

  //this is used to access the last joint added to the mechanism so it can be referenced to create new links/joints
  getLastJoint(joints: IterableIterator<Joint>): Joint | undefined{
    let lastJoint: Joint | undefined;
    for (const joint of joints) {
      lastJoint = joint;
    }
    if (lastJoint !== undefined) {
      return lastJoint;
    }
    else
      return undefined;
  }

  //this is used to access the last link added to the mechanism so it can be referenced to create new links/joints
  getLastLink(links: IterableIterator<Link>): Link | undefined {
    let lastLink: Link | undefined;
    for (const link of links) {
      lastLink = link;
    }
    if (lastLink !== undefined) {
      return lastLink;
    }
    else
      return undefined;
  }

  protected readonly window = window;
}
