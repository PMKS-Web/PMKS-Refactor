import {Component} from '@angular/core'
import {StateService} from "src/app/services/state.service";
import {InteractionService} from "src/app/services/interaction.service";
import {Mechanism} from "src/app/model/mechanism";
import {LinkInteractor} from "src/app/controllers/link-interactor";
import {Joint} from "src/app/model/joint";
import {AnalysisSolveService, JointAnalysis, LinkAnalysis} from "src/app/services/analysis-solver.service";

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
  referenceJoint: Joint = this.getCurrentLink().joints.get(0) as Joint;
  currentGlobalUSuffix: any;
  currentGlobalAngleSuffix: any;
  constructor(private stateService: StateService, private interactorService: InteractionService,
              private analysisSolverService: AnalysisSolveService){
    this.stateService.globalUSuffixCurrent.subscribe(value => {
      this.currentGlobalUSuffix = value;
    });
    this.stateService.globalASuffixCurrent.subscribe(value => {
      this.currentGlobalAngleSuffix = value;
    });

  }

  getMechanism(): Mechanism {return this.stateService.getMechanism();}
  getCurrentLink(){
    let currentLinkInteractor = this.interactorService.getSelectedObject();
    return (currentLinkInteractor as LinkInteractor).getLink();
  }
  getLinkName(): string {return this.getCurrentLink().name;}
  getReferenceJoint(){return this.referenceJoint;}
// get x coord and y coord return the number of the center of mass
  getCOMXCoord(): number {return this.getCurrentLink()?.centerOfMass.x.toFixed(3) as unknown as number;}
  getCOMYCoord(): number {return this.getCurrentLink()?.centerOfMass.y.toFixed(3) as unknown as number;}
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

  toggleGraph(graphType: GraphType) {
    if (this.currentGraphType === graphType) {
      this.closeAnalysisGraph(); // If the graph is open, close it
    } else {
      this.openAnalysisGraph(graphType); // If it's closed, open it
    }
  }
  getGraphTypeName(graphType: GraphType): string {
    switch (graphType) {
      case GraphType.CoMPosition:
        return 'Center of Mass Position';
      case GraphType.CoMVelocity:
        return 'Center of Mass Velocity (' + this.currentGlobalUSuffix + '/s)';
      case GraphType.CoMAcceleration:
        return 'Center of Mass Acceleration(' + this.currentGlobalUSuffix + '/s²)';
      case GraphType.referenceJointAngle:
        return 'Reference Joint Angle(' + this.currentGlobalAngleSuffix + ')';
      case GraphType.referenceJointAngularVelocity:
        return 'Reference Joint Angular Velocity(' + this.currentGlobalAngleSuffix + '/s)';
      case GraphType.referenceJointAngularAcceleration:
        return 'Reference Joint Angular Acceleration(' + this.currentGlobalAngleSuffix + '/s²)';
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
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Position");

      case GraphType.CoMVelocity:
        jointKinematics = this.analysisSolverService.getJointKinematics(this.getPlaceholderCoMJoint().id);
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Velocity");

      case GraphType.CoMAcceleration:
        jointKinematics = this.analysisSolverService.getJointKinematics(this.getPlaceholderCoMJoint().id);
        return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, "Acceleration");


      case GraphType.referenceJointAngle:
        if(this.getReferenceJoint() !== undefined) {
          let joints = this.getCurrentLink().getJoints();
          let jointIds = joints.map(joint => joint.id);
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds);
          return this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Angle");
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
          return this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Velocity");
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
          return this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Acceleration");
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
  public GraphType = GraphType;

  downloadCSV() {
    const table = document.querySelector(".table-auto");
    if (!table) return;

    const selections = Array.from(
      table.querySelectorAll<HTMLInputElement>("input[type='checkbox']:checked")
    ).map((input) => ({
      entity: input.dataset["entity"] || "",
      parameter: input.dataset["parameter"] || ""
    }));

    if (selections.length === 0) {
      alert("No selections made");
      return;
    }

    const unsupportedSelections = selections.filter(selection =>
      !["position", "velocity", "acceleration"].includes(selection.parameter)
    );
    if (unsupportedSelections.length > 0) {
      alert("CSV export currently supports only position, velocity, and acceleration selections.");
      return;
    }

    this.analysisSolverService.updateKinematics();
    const mechanism = this.getMechanism();
    const mechanismJoints = mechanism.getArrayOfJoints()
      .map(joint => ({joint, analysis: this.analysisSolverService.getJointKinematics(joint.id)}))
      .filter(({analysis}) => !!analysis);
    const mechanismLinks = mechanism.getArrayOfLinks()
      .map(link => ({link, joints: link.getJoints()}))
      .filter(({joints}) => joints.length >= 2)
      .map(({link, joints}) => ({
        link,
        analysis: this.analysisSolverService.getLinkKinematics(joints.map(joint => joint.id))
      }))
      .filter(({analysis}) => !!analysis);

    if (mechanismJoints.length === 0 && mechanismLinks.length === 0) {
      alert("No kinematic data available for export.");
      return;
    }

    const series: Array<{header: string, values: number[]}> = [];

    const jointParameters = selections
      .filter(selection => selection.entity === "joints")
      .map(selection => selection.parameter);
    const linkParameters = selections
      .filter(selection => selection.entity === "links")
      .map(selection => selection.parameter);

    if (jointParameters.length > 0) {
      this.appendJointSeries(series, mechanismJoints, jointParameters);
    }

    if (linkParameters.length > 0) {
      for (const {link, analysis} of mechanismLinks) {
        this.appendLinkSeries(series, link.name, analysis, linkParameters);
      }
    }

    if (series.length === 0) {
      alert("The selected export options did not produce any CSV data.");
      return;
    }

    const numFrames = series[0].values.length;
    const timeIncrement = mechanismLinks[0]?.analysis.timeIncrement || mechanismJoints[0]?.analysis.timeIncrement || 0;
    const rows: string[] = [["Time", ...series.map(item => item.header)].join(",")];

    for (let index = 0; index < numFrames; index++) {
      const time = timeIncrement > 0 ? index * timeIncrement : index;
      rows.push([time, ...series.map(item => item.values[index])].join(","));
    }

    const csvContent = rows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "selected_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private appendJointSeries(
    series: Array<{header: string, values: number[]}>,
    jointAnalyses: Array<{joint: Joint, analysis: JointAnalysis}>,
    parameters: string[]
  ): void {
    for (const {joint, analysis} of jointAnalyses) {
      for (const parameter of parameters) {
        switch (parameter) {
          case "position":
            series.push(
              {header: `joint_${joint.id}_x`, values: analysis.positions.map(coord => coord.x)},
              {header: `joint_${joint.id}_y`, values: analysis.positions.map(coord => coord.y)}
            );
            break;
          case "velocity":
            series.push(
              {header: `joint_${joint.id}_vx`, values: analysis.velocities.map(coord => coord.x)},
              {header: `joint_${joint.id}_vy`, values: analysis.velocities.map(coord => coord.y)}
            );
            break;
          case "acceleration":
            series.push(
              {header: `joint_${joint.id}_ax`, values: analysis.accelerations.map(coord => coord.x)},
              {header: `joint_${joint.id}_ay`, values: analysis.accelerations.map(coord => coord.y)}
            );
            break;
        }
      }
    }
  }

  private appendLinkSeries(
    series: Array<{header: string, values: number[]}>,
    linkName: string,
    linkKinematics: LinkAnalysis,
    parameters: string[]
  ): void {
    for (const parameter of parameters) {
      switch (parameter) {
        case "position":
          series.push(
            {
              header: `link_${linkName}_angle_deg`,
              values: linkKinematics.angle.map(angle => {
                let normalizedAngle = angle % (2 * Math.PI);
                if (normalizedAngle < 0) {
                  normalizedAngle += 2 * Math.PI;
                }
                return normalizedAngle * 180 / Math.PI;
              })
            }
          );
          break;
        case "velocity":
          series.push(
            {header: `link_${linkName}_omega_rad_s`, values: linkKinematics.angularVelocity}
          );
          break;
        case "acceleration":
          series.push(
            {header: `link_${linkName}_alpha_rad_s2`, values: linkKinematics.angularAcceleration}
          );
          break;
      }
    }
  }
}
