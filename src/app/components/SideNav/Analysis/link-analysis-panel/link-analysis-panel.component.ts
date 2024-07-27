import {Component} from '@angular/core'
import {StateService} from "src/app/services/state.service";
import {InteractionService} from "src/app/services/interaction.service";
import {Mechanism} from "src/app/model/mechanism";
import {LinkInteractor} from "src/app/controllers/link-interactor";
import {PositionSolverService} from "src/app/services/kinematic-solver.service";
import {Joint} from "src/app/model/joint";
import {AnalysisSolveService, JointAnalysis} from "src/app/services/analysis-solver.service";

interface Tab {
    selected: boolean,
    label: string,
    icon: string
}

// enum contains every kind of graph this panel can open.
export enum GraphType {
  CoMPosition,
  CoMVelocity,
  CoMAcceleration,
  referenceJointAngle,
  referenceJointAngularVelocity,
  referenceJointAngularAcceleration
  // Add more graph types as needed
}

@Component({
    selector: 'app-link-analysis-panel',
    templateUrl: './link-analysis-panel.component.html',
    styleUrls: ['./link-analysis-panel.component.scss'],

})

export class LinkAnalysisPanelComponent {

  currentGraphType: GraphType | null = null;
  graphTypes = GraphType;
  referenceJoint: Joint = this.getCurrentLink().joints.get(0) as Joint;

  graphExpanded: { [key: string]: boolean } = {
    dataSummary: true,
    graphicalAnalysis: false,
    positionOfJoint: false,
      velocityOfJoint: false,
      accelerationOfJoint: false
  };

  constructor(private stateService: StateService, private interactorService: InteractionService,
              private positionSolver: PositionSolverService, private analysisSolverService: AnalysisSolveService){
      console.log("joint-analysis-panel.constructor");
  }

  getMechanism(): Mechanism {return this.stateService.getMechanism();}
  getCurrentLink(){
    let currentLinkInteractor = this.interactorService.getSelectedObject();
    return (currentLinkInteractor as LinkInteractor).getLink();
  }
  getLinkName(): string {return this.getCurrentLink().name;}
    getReferenceJoint(){return this.referenceJoint;}
    getReferenceJointName(){return this.getReferenceJoint()?.name;}
    getReferenceJointXCoord(){return this.getReferenceJoint()?.coords.x.toFixed(3) as unknown as number;}
    getReferenceJointYCoord(){return this.getReferenceJoint()?.coords.y.toFixed(3) as unknown as number;}



    // get x coord and y coord return the number of the center of mass
  getCOMXCoord(): number {return this.getCurrentLink()?.centerOfMass.x.toFixed(3) as unknown as number;}
    getCOMYCoord(): number {return this.getCurrentLink()?.centerOfMass.y.toFixed(3) as unknown as number;}


  setJointXCoord(xCoordInput: number): void {this.getMechanism().setXCoord(this.getCurrentLink().id, xCoordInput);}
  setJointYCoord(yCoordInput: number): void {this.getMechanism().setYCoord(this.getCurrentLink().id, yCoordInput);}

  openAnalysisGraph(graphType: GraphType): void {
    this.currentGraphType = graphType;
    if(this.currentGraphType == GraphType.CoMPosition ||
      this.currentGraphType == GraphType.CoMVelocity ||
      this.currentGraphType == GraphType.CoMAcceleration){
      this.addPlaceholderCoMJoint();
    }
    this.getGraphData();
  }

  closeAnalysisGraph() {
    if(this.currentGraphType == GraphType.CoMPosition ||
      this.currentGraphType == GraphType.CoMVelocity ||
      this.currentGraphType == GraphType.CoMAcceleration) {
      this.removePlaceholderCoMJoint();
    }

    this.currentGraphType = null;
  }

  getGraphTypes(){
    // @ts-ignore
    return Object.keys(this.graphTypes).filter(key => !isNaN(Number(this.graphTypes[key]))).map(key => Number(this.graphTypes[key])) as GraphType[];
  }

  getGraphTypeName(graphType: GraphType): string {
    switch (graphType) {
      case GraphType.CoMPosition:
        return 'Center of Mass Position';
      case GraphType.CoMVelocity:
        return 'Center of Mass Velocity';
      case GraphType.CoMAcceleration:
        return 'Center of Mass Acceleration';
      case GraphType.referenceJointAngle:
        return 'Reference Joint Angle'
      case GraphType.referenceJointAngularVelocity:
        return 'Reference Joint Angular Velocity'
      case GraphType.referenceJointAngularAcceleration:
        return 'Reference Joint Angular Acceleration'
      // Add more cases as needed
      default:
        return ''; // Handle unknown cases or add a default value
    }
  }

  // create a new joint in the center of mass of the current link
  // use this joint for solving position data
  // basically a sneaky workaround to position solving an actual link (which would be hard)
  addPlaceholderCoMJoint(): void{
    let CoM = this.getCurrentLink().centerOfMass;
    // DO NOT REMOVE THESE VALUE CHANGES
    // PUTTING THE TRACER POINT PERFECTLY IN LINE BREAKS EVERYTHING
    // THESE ARE NECESSARY TO WORK (FOR SOME REASON)
    CoM.x = CoM.x - 0.00001;
    CoM.y = CoM.y - 0.00001;
    let linkID = this.getCurrentLink().id;
    this.getMechanism().addJointToLink(linkID, CoM);
  }

  // deletes placeholder joint. Should be called immediately after closing graphs, so as
  // to not compromise the mechanism people have made
  removePlaceholderCoMJoint(): void {
    this.getMechanism().removeJoint(this.getPlaceholderCoMJoint().id);
  }

  // function searches through current link to find the placeholder joint:
  // the placeholder joint will always have the highest joint ID, because
  // it is being created directly before this function call
  // (and thus nothing could be higher than it)
  getPlaceholderCoMJoint(): Joint {
    const joints = this.getCurrentLink().joints;

    let maxJoint: Joint;
    let maxID = Number.MIN_SAFE_INTEGER;

    for (const [jointID, joint] of joints.entries()) {
      if (jointID > maxID) {
        maxID = jointID;
        maxJoint = joint;
      }
    }

    // @ts-ignore
    return maxJoint;
}

  // calls the positionSolver on current joint and reformats data into a type that chart,js can take
  // see transformJointKinematicGraph function in kinematic solver for more detail
  getGraphData() {
    this.analysisSolverService.updateKinematics();
    let jointKinematics: JointAnalysis;
    switch(this.currentGraphType) {
      case GraphType.CoMPosition:
        jointKinematics = this.analysisSolverService.getJointKinematics(this.getPlaceholderCoMJoint().id);
        let comPositionChartData = this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Position");
        return comPositionChartData;

      case GraphType.CoMVelocity:
        jointKinematics = this.analysisSolverService.getJointKinematics(this.getPlaceholderCoMJoint().id);
        let comVelocityChartData = this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Velocity");
        return comVelocityChartData;

      case GraphType.CoMAcceleration:
        jointKinematics = this.analysisSolverService.getJointKinematics(this.getPlaceholderCoMJoint().id);
        let comAccelerationChartData = this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Acceleration");
        return comAccelerationChartData;


      case GraphType.referenceJointAngle:
        if(this.getReferenceJoint() !== undefined) {
          let joints = this.getCurrentLink().getJoints();
          let jointIds = joints.map(joint => joint.id);
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds);
          let chartData = this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Angle");
          return chartData;
        }
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };

      case GraphType.referenceJointAngularVelocity:
        if(this.getReferenceJoint() !== undefined) {
          let joints = this.getCurrentLink().getJoints();
          let jointIds = joints.map(joint => joint.id);
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds);
          let chartData = this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Velocity");
          return chartData;
        }
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };

      case GraphType.referenceJointAngularAcceleration:
        if(this.getReferenceJoint() !== undefined) {
          let joints = this.getCurrentLink().getJoints();
          let jointIds = joints.map(joint => joint.id);
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds);
          let chartData = this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Acceleration");
          return chartData;
        }
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };
      default:
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };
    }
  }

  onReferenceJointSelected(joint: Joint){
    this.referenceJoint = joint;
  }

 public GraphType = GraphType;
}
