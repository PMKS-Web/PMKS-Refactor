import {Component} from '@angular/core'
import {StateService} from "src/app/services/state.service";
import {InteractionService} from "src/app/services/interaction.service";
import {Mechanism} from "src/app/model/mechanism";
import {LinkInteractor} from "src/app/controllers/link-interactor";
import {Joint} from "src/app/model/joint";
import {AnalysisSolveService, JointAnalysis, LinkAnalysis} from "src/app/services/analysis-solver.service";
import {Coord} from "../../../../model/coord";

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
    // if(this.currentGraphType == GraphType.CoMPosition ||
    //   this.currentGraphType == GraphType.CoMVelocity ||
    //   this.currentGraphType == GraphType.CoMAcceleration){
    //   this.addPlaceholderCoMJoint();
    // }
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
    let currentLinkId = this.getCurrentLink().id;
    const links = this.getMechanism().getArrayOfLinks();
    const linkIndex = links.findIndex(link => link.id === currentLinkId);
    let joints = this.getMechanism().getArrayOfJoints();
    let jointIds = joints.map(joint => joint.id);

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
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds, linkIndex);
          return this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Angle");
        }
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };

      case GraphType.referenceJointAngularVelocity:
        if(this.getReferenceJoint() !== undefined) {
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds, linkIndex);
          return this.analysisSolverService.transformLinkKinematicGraph(linkKinematics, "Velocity");
        }
        return {
          xData: [],
          yData: [],
          timeLabels: []
        };

      case GraphType.referenceJointAngularAcceleration:
        if(this.getReferenceJoint() !== undefined) {
          let linkKinematics = this.analysisSolverService.getLinkKinematics(jointIds, -1);
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

  // Re-write from original
  downloadCSV(): void {
    console.log("DOWNLOAD CSV (multi-link angular data)");

    // 1. Make sure kinematics are up to date
    this.analysisSolverService.updateKinematics();

    const mechanism = this.getMechanism();
    const allLinks = mechanism.getArrayOfLinks();          // all Link objects
    const allJoints = mechanism.getArrayOfJoints();
    const jointIds = allJoints.map(j => j.id);

    if (!allLinks.length) {
      alert("No links in mechanism.");
      return;
    }

    // OPTIONAL: if you want to skip a ground link, you can filter here.
    // Example heuristic: ignore links whose joints are all grounded.
    // (Assumes your Joint class has `isGrounded`.)
    const movingLinks = allLinks.filter(link =>
      !link.getJoints().every(j => (j as any).isGrounded)
    );

    const linksToExport = movingLinks.length ? movingLinks : allLinks;

    // 2. For each link, get its LinkAnalysis (angle + angularVelocity arrays)
    const perLinkData = linksToExport.map(link => {
      const linkIndex = allLinks.findIndex(l => l.id === link.id);
      const analysis = this.analysisSolverService.getLinkKinematics(
        jointIds,
        linkIndex
      );

      return {
        link,
        analysis,                           // LinkAnalysis
        name: link.name || `Link ${link.id}`
      };
    });

    const EPS = 1e-6;
    const movingPerLinkData = perLinkData.filter(d =>
      d.analysis.angularVelocity.some(w => Math.abs(w) > EPS)
    );

    if (!perLinkData.length) {
      alert("No link kinematics available.");
      return;
    }

    // Assume all links share same timeIncrement & number of steps
    const numSteps = movingPerLinkData[0].analysis.angularVelocity.length;
    const dt       = movingPerLinkData[0].analysis.timeIncrement;

    if (!numSteps) {
      alert("No time steps in kinematic solution.");
      return;
    }

    // 3. Build header row
    const header: string[] = ["Current Time"];
    for (const d of movingPerLinkData) {
      header.push(`${d.name} angle degree`);
      header.push(`${d.name} angVel rad/s`);
    }

    const rows: string[] = [];
    rows.push(header.join(","));

    // 4. Build data rows: one row per time step
    for (let i = 0; i < numSteps; i++) {
      const t = i.toString();      // match your screenshot precision
      const row: string[] = [t];

      for (const d of perLinkData) {
        const angRad = d.analysis.angle[i] ?? 0;
        const omega  = d.analysis.angularVelocity[i] ?? 0;

        const angDeg = (angRad * 180 / Math.PI).toFixed(4);
        const omegaStr = omega.toFixed(4);

        row.push(angDeg, omegaStr);
      }

      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    // 5. Download as CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const linkEl = document.createElement("a");
    linkEl.href = url;
    linkEl.download = "link_angular_kinematics.csv";
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
    URL.revokeObjectURL(url);
  }


  getCurrentLinkId(): number | null {
    const link = this.getCurrentLink();
    return link ? link.id : null;
  }
}
