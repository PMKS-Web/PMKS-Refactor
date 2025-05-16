import {Component} from '@angular/core'
import {StateService} from "src/app/services/state.service";
import {InteractionService} from "src/app/services/interaction.service";
import {JointInteractor} from "src/app/controllers/joint-interactor"
import {Mechanism} from "src/app/model/mechanism";
import {Joint} from "src/app/model/joint";
import {Link} from "src/app/model/link";
import {AnalysisSolveService} from "src/app/services/analysis-solver.service";

// enum contains every kind of graph this panel can open.
export enum GraphType {
  JointPosition,
  JointVelocity,
  JointAcceleration,
  // Add more graph types as needed
}
@Component({
    selector: 'app-joint-analysis-panel',
    templateUrl: './joint-analysis-panel.component.html',
    styleUrls: ['./joint-analysis-panel.component.scss'],

})


export class JointAnalysisPanelComponent {

  currentGraphType: GraphType | null = null;
// Make the enum accessible in the template


  graphExpanded: { [key: string]: boolean } = {
    dataSummary: true,
    graphicalAnalysis: false,
    positionOfJoint: false,
      velocityOfJoint: false,
      accelerationOfJoint: false
  };

  constructor(private stateService: StateService,
              private interactorService: InteractionService,
              private analysisSolverService: AnalysisSolveService){
  }

  // helper function to open a graph using the graph-button block
  openAnalysisGraph(graphType: GraphType): void {
    this.currentGraphType = graphType;
    //this.getGraphData();
  }

  closeAnalysisGraph() {this.currentGraphType = null;}

  getGraphTypeName(graphType: GraphType): string {
    switch (graphType) {
      case GraphType.JointPosition:
        return 'Position';
      case GraphType.JointVelocity:
        return 'Velocity';
      case GraphType.JointAcceleration:
        return 'Acceleration';
      // Add more cases as needed
      default:
        return ''; // Handle unknown cases or add a default value
    }
  }

  // utilizes enums to properly open each graph and find the data for it.
  // will one day have velocity, acceleration, the whole 9 yards.
  // calls the positionSolver and reformats data into a type that chart,js can take
  // see TransformPositionsForChart function in kinematic solver for more detail
  getGraphData() {
    this.analysisSolverService.updateKinematics();
    const jointKinematics = this.analysisSolverService.getJointKinematics(this.getCurrentJoint().id);
    switch(this.currentGraphType) {
      case GraphType.JointPosition:
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, this.getGraphTypeName(this.currentGraphType));

      case GraphType.JointVelocity:
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, this.getGraphTypeName(this.currentGraphType));


      case GraphType.JointAcceleration:
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, this.getGraphTypeName(this.currentGraphType));

      default:
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };
    }
  }

  getMechanism(): Mechanism {return this.stateService.getMechanism();}

  // Returns the joint currently selected in the UI
  getCurrentJoint(){
    let currentJointInteractor = this.interactorService.getSelectedObject();
    return (currentJointInteractor as JointInteractor).getJoint();
  }

  // Returns the name of the currently selected joint
  getJointName(): string {
    return this.getCurrentJoint().name;
  }

  // Returns the X coordinate of the joint
  getJointXCoord(): number {
    return this.getCurrentJoint().coords.x.toFixed(3) as unknown as number;
  }

  // Returns the Y coordinate of the joint
  getJointYCoord(): number {
    return this.getCurrentJoint().coords.y.toFixed(3) as unknown as number;
  }

  // Calculates distance between current joint and the given connected joint
  getJointDistance(otherJoint: Joint): number{
    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;

    let hypotenuse = (xDiff*xDiff) + (yDiff*yDiff);
    return Math.sqrt(hypotenuse);
  }

  // Calculates angle between current joint and the given connected joint
  getJointAngle(otherJoint: Joint): number{

    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;
    // Calculate the angle using arc tangent
    const angleInRadians = Math.atan2(yDiff, xDiff);

    // Convert the angle to degrees
    let angleInDegrees = angleInRadians * (180 / Math.PI);

    // Ensure the angle is in the range of +180 to -180 degrees
    if (angleInDegrees > 180) {
      angleInDegrees -= 360;
    } else if (angleInDegrees < -180) {
      angleInDegrees += 360;
    }
    return angleInDegrees;
  }
// geteLinksForJoint and getConnectedJoints are both used to dynamically
  // view and modify the connected joints in a mechanism. Is sent to a loop of
  // dual input blocks in the HTML, that's created by looping through all of the
  // connected joints
  getLinksForJoint(): IterableIterator<Link> {return this.getMechanism().getConnectedLinksForJoint(this.getCurrentJoint()).values();}

  getConnectedJoints(): Joint[] {
    const connectedLinks: Link[] = Array.from(this.getLinksForJoint());
    return connectedLinks.reduce(
      (accumulator: Joint[], link: Link) => {
        const jointMap: Map<number, Joint> = link.joints;
        const joints: Joint[] = Array.from(jointMap.values());
        return accumulator.concat(joints);
      },
      []
    );
  }

  // Function utilized in conjunction with dual input blocks to change the angle of the current
  // joint (the first parameter) in relation to the second joint (the second parameter).
  // TODO does not currently work. need to account for several joints. is placeholder!
  changeJointAngle(jointIDReference: number, newAngle: number): void {
    console.log("changing angle from this joint ", jointIDReference, " to this angle ", newAngle);
    this.getMechanism().setAngleToJoint(this.getCurrentJoint().id, jointIDReference, newAngle);
  }
  // Function utilized in conjunction with dual input blocks to change the distance of the current
  // joint (the first parameter) in relation to the second joint (the second parameter).
  // TODO does not currently work. need to account for several joints. is placeholder!
  changeJointDistance(jointIDReference: number, newDistance: number): void {
    console.log("changing distance from this joint ", jointIDReference, " to this distance ", newDistance);
    this.getMechanism().setDistanceToJoint(this.getCurrentJoint().id, jointIDReference, newDistance);
  }

  protected readonly GraphType = GraphType;
}
