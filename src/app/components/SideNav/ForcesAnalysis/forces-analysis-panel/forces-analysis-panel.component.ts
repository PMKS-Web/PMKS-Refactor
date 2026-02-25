import { Component} from '@angular/core'
import { AnimationService } from 'src/app/services/animation.service';
import { InteractionService } from 'src/app/services/interaction.service'
import {Mechanism} from "../../../../model/mechanism";
import {StateService} from "../../../../services/state.service";
import {AnalysisSolveService} from "../../../../services/analysis-solver.service";
import {RigidBody} from "../../../../model/link";
import {Joint} from "../../../../model/joint";
import {JointInteractor} from "../../../../controllers/joint-interactor";
import {LinkInteractor} from "../../../../controllers/link-interactor";

export enum GraphType {
  JointForce
}

@Component({
  selector: 'app-forces-analysis-panel',
  templateUrl: './forces-analysis-panel.component.html',
  styleUrls: ['./forces-analysis-panel.component.scss'],

})
export class ForcesAnalysisPanelComponent {
  currentGraphType: GraphType | null = null;
  selectedSubId: number | null = null;
  currentGlobalUSuffix: any;
  currentGlobalAngleSuffix: any;
  selectedJointId: number | null = null;

  constructor(
    private stateService: StateService,
    private analysisSolverService: AnalysisSolveService,
    private interactionService: InteractionService,
    private animationService: AnimationService
  ) {
    this.stateService.globalASuffixCurrent.subscribe(value => {
      this.currentGlobalAngleSuffix = value;
    });
  }


  getSelectedObjectType(): string{
    let obj = this.interactionService.getSelectedObject();
    if(obj == undefined){
      return '';
    } else{
      return obj.type();
    }
  }

  get invalid(){
    return this.animationService.isInvalid();
  }

  //////////// JOINT /////////////////
  getCurrentJoint(): Joint {
    let currentJointInteractor = this.interactionService.getSelectedObject();
    return (currentJointInteractor as JointInteractor).getJoint();
  }

  getJointName(): string {
    return this.getCurrentJoint().name;
  }

  getJointForce(): string {
    // const joint = this.getCurrentJoint();
    // const kinematics = this.analysisSolverService.getJointKinematics(joint.id);
    // const latest = kinematics.forces[kinematics.forces.length - 1];
    // return latest.x.toFixed(3);

    return this.getCurrentJoint().name;
  }

  toggleGraph(graphType: GraphType) {
    if (this.currentGraphType === graphType) {
      this.closeAnalysisGraph();
    } else {
      this.currentGraphType = graphType;
    }
  }

  closeAnalysisGraph() {
    this.currentGraphType = null;
  }

  getGraphData() {
    this.analysisSolverService.updateKinematics();
    const jointKinematics = this.analysisSolverService.getJointKinematics(this.getCurrentJoint().id);
    console.log("getCurrentJoint: "+ this.getCurrentJoint().id);
    if (this.currentGraphType != null) {
      return this.analysisSolverService.transformJointKinematicGraph(jointKinematics, 'Force');
    } else {
      return {
        xData: [],
        yData: [],
        timeLabels: []
      };
    }
  }

  protected readonly GraphType = GraphType;

  //////// Link //////////
  getCurrentLink(){
    let currentLinkInteractor = this.interactionService.getSelectedObject();
    return (currentLinkInteractor as LinkInteractor).getLink();
  }
  getLinkName(): string {
    return this.getCurrentLink().name;
  }

  toggleJointForceGraph(jointId: number) {

    if (this.selectedJointId === jointId) {
      this.selectedJointId = null;
    } else {
      this.selectedJointId = jointId;
    }

    this.currentGraphType = GraphType.JointForce;
  }

  closeJointForceGraph() {
    this.selectedJointId = null;
  }

  getJointForceGraphData(jointId: number) {

    const jointKinematics =
      this.analysisSolverService.getJointKinematics(jointId);

    if (!jointKinematics) {
      return { xData: [], yData: [], timeLabels: [] };
    }

    return this.analysisSolverService.transformJointKinematicGraph(
      jointKinematics,
      "Force"
    );
  }



  ///////// SUBMECHANISM ///////////////
  getSubMechanisms(): Array<Map<Joint, RigidBody[]>> {
    return this.stateService.getMechanism().getSubMechanisms();
  }

  toggleSubTorqueGraph(index: number) {

    if (this.selectedSubId === index) {
      this.selectedSubId = null;
    } else {
      this.selectedSubId = index;
    }
  }






  downloadCSV() {
    const table = document.querySelector(".table-auto");
    if (!table) return;

    const headers: string[] = [];
    const data: string[][] = [];

    const ths = table.querySelectorAll("thead td");
    ths.forEach((th, colIndex) => {
      if (colIndex > 0) {
        headers.push(th.textContent?.trim() || "");
      }
    });

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      const rowHeader = cells[0].textContent?.trim() || "";

      cells.forEach((cell, index) => {
        const checkbox = cell.querySelector("input[type='checkbox']") as HTMLInputElement;
        if (checkbox && checkbox.checked) {
          data.push([`${headers[index - 1]} ${rowHeader}`]);
        }
      });
    });

    if (data.length === 0) {
      alert("No selections made");
      return;
    }

    const csvContent = ["Time," + data.map(d => d[0]).join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "selected_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
