import {Component, OnDestroy, OnInit} from '@angular/core'
import { AnimationService } from 'src/app/services/animation.service';
import { InteractionService } from 'src/app/services/interaction.service'
import {Mechanism} from "../../../../model/mechanism";
import {StateService} from "../../../../services/state.service";
import {AnalysisSolveService} from "../../../../services/analysis-solver.service";
import {RigidBody} from "../../../../model/link";
import {Joint} from "../../../../model/joint";
import {JointInteractor} from "../../../../controllers/joint-interactor";
import {LinkInteractor} from "../../../../controllers/link-interactor";
import {ComprehensiveFrameData, StaticsAnalysisService} from "../../../../services/statics-analysis.service";
import { Subscription } from 'rxjs';

export enum GraphType {
  JointForce
}

@Component({
  selector: 'app-forces-analysis-panel',
  templateUrl: './forces-analysis-panel.component.html',
  styleUrls: ['./forces-analysis-panel.component.scss'],
  })
export class ForcesAnalysisPanelComponent implements OnInit, OnDestroy {
  public currentGraphType: GraphType | null = null;
  public selectedSubId: number | null = null;
  public currentGlobalUSuffix: any;
  public currentGlobalAngleSuffix: any;
  public selectedJointId: number | null = null;
  public currentFrameIndex: number = 0;


  private subscriptions: Subscription[] = [];
  subMechanismTorques: Map<number, string> = new Map(); // Store torque values

  // Export options
  exportAllJointForces = false;
  exportAllLinkForces = false;

  constructor(
    private stateService: StateService,
    private analysisSolverService: AnalysisSolveService,
    private interactionService: InteractionService,
    private animationService: AnimationService,
    private staticsAnalysis: StaticsAnalysisService,
  ) {
    this.stateService.globalASuffixCurrent.subscribe(value => {
      this.currentGlobalAngleSuffix = value;
    });
  }

  ngOnInit(): void {

    const frameSub = this.animationService.currentFrameIndex$
      .subscribe(index => {
        this.currentFrameIndex = index;

        this.updateTorqueValues(); // Only update torque values when frame changes
      });

      console.log("On init created");

      this.subscriptions.push(frameSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  analyzeAllSubMechanisms(): void {

    const mechanism = this.stateService.getMechanism();
    const subMechanisms = mechanism.getSubMechanisms();

    for (let i = 0; i < subMechanisms.length; i++) {
      this.staticsAnalysis.analyzeIfNeeded(i);
    }
  }

  // This will be called when user expands the drop-down
  onSectionOpened(): void {
    this.analyzeAllSubMechanisms();
    this.updateTorqueValues();// Update torque values after analysis
  }

  /**
   * Update torque values for all sub-mechanisms
   * Only called when frame changes or after analysis
   */
   private updateTorqueValues(): void {
    const subMechanisms = this.getSubMechanisms();

    subMechanisms.forEach((subMech, index) => {
      const torque = this.getSubMechanismTorque(index);
      this.subMechanismTorques.set(index, torque);
    });
  }

  getTorqueForDisplay(subIndex: number): string {
    return this.subMechanismTorques.get(subIndex) ?? 'N/A';
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

  private getCurrentFrameDataForJoint(jointId: number): ComprehensiveFrameData | null {

    const mechanism = this.stateService.getMechanism();
    const subMechanisms = mechanism.getSubMechanisms();

    for (let i = 0; i < subMechanisms.length; i++) {

      const sub = subMechanisms[i];

      for (let joint of sub.keys()) {
        if (joint.id === jointId) {

          const frameData =
            this.staticsAnalysis.getAnalysisResultAtFrame(i, this.currentFrameIndex);

          if (!frameData) {
            console.warn("Frame data is null");
            return null;
          }

          return frameData;
        }
      }
    }
    return null;
  }

  getCurrentJoint(): Joint {
    let currentJointInteractor = this.interactionService.getSelectedObject();
    return (currentJointInteractor as JointInteractor).getJoint();
  }

  getJointName(): string {
    return this.getCurrentJoint().name;
  }

  getJointForce(jointId : number): string {

    // const jointId = this.getCurrentJoint().id;
    const frameData = this.getCurrentFrameDataForJoint(jointId);

    if (!frameData) {
        console.warn("Frame data is null");
        return "0";
      }

    const reaction = frameData.solution.reactionForces.get(jointId);

    if (!reaction) {
      console.warn(`No reaction force found for Joint ${jointId}`);
      return "0";
    }

    console.log("Reaction Force:", reaction);

    const Fx = reaction.Fx ?? 0;
    const Fy = reaction.Fy ?? 0;

    return `Fx: ${Fx.toFixed(4)} N, Fy: ${Fy.toFixed(4)} N;`;
  }

  getJointTorque(jointId : number): string {
    if (!this.getCurrentJoint().isInput) return '';

    const frameData = this.getCurrentFrameDataForJoint(jointId);

    if (!frameData) {
      console.warn("Frame data is null");
      return "0";
    }

    const torque = frameData.solution.motorTorque ?? 0;
    return `${torque.toFixed(4)} N`;
  }

  hasJointInput(joint: Joint): boolean {
     return this.getCurrentJoint().isInput;
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

  getSubMechanismTorque(subIndex: number): string {

    const frameData =
      this.staticsAnalysis.getAnalysisResultAtFrame(subIndex, this.currentFrameIndex);

    // console.log(
    //   "Frame:",
    //   this.currentFrameIndex,
    //   "Sub:",
    //   subIndex,
    //   "FrameData:",
    //   frameData
    // );

    if (!frameData) {
      return 'N/A';
    }

    const torque = frameData.solution.motorTorque;
    // console.log(`Torque at frame ${this.currentFrameIndex}: ${torque.toFixed(2)} N⋅m`);


    return torque.toFixed(2) ?? 'N/A';
  }


  downloadCSV(exportJointForces: boolean, exportLinkForces: boolean) {

    if (!exportJointForces && !exportLinkForces) {
      alert("No data selected for export.");
      return;
    }

    const mechanism = this.stateService.getMechanism();
    const subMechanisms = mechanism.getSubMechanisms();

    const rows: string[] = [];

    for (let subIndex = 0; subIndex < subMechanisms.length; subIndex++) {

      const data =
        this.staticsAnalysis.getLastAnalysisResults(subIndex);

      if (!data || data.length === 0) continue;

      const firstFrame = data[0];

      const headers: string[] = ['SubMechanism', 'Frame', 'Time'];

      if (exportJointForces || exportLinkForces) {
        headers.push('MotorTorque_Nm');

        firstFrame.solution.reactionForces.forEach((_, jointId) => {
          headers.push(
            `Joint${jointId}_Fx_N`,
            `Joint${jointId}_Fy_N`
          );
        });
      }

      rows.push(headers.join(','));

      data.forEach((frame, frameIndex) => {

        const row: string[] = [
          subIndex.toString(),
          frameIndex.toString(),
          frame.time.toString()
        ];

        if (exportJointForces || exportLinkForces) {

          row.push(
            (frame.solution.motorTorque ?? 0).toFixed(6)
          );

          frame.solution.reactionForces.forEach(force => {
            row.push(
              (force.Fx ?? 0).toFixed(4),
              (force.Fy ?? 0).toFixed(4)
            );
          });
        }

        rows.push(row.join(','));
      });

      rows.push('');
    }

    const blob = new Blob([rows.join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'force_export.csv';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

}
