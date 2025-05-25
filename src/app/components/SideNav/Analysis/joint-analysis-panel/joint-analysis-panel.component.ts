import {Component} from '@angular/core'
import {StateService} from "src/app/services/state.service";
import {InteractionService} from "src/app/services/interaction.service";
import {JointInteractor} from "src/app/controllers/joint-interactor"
import {Mechanism} from "src/app/model/mechanism";
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
  constructor(private stateService: StateService,
              private interactorService: InteractionService,
              private analysisSolverService: AnalysisSolveService){
      console.log("joint-analysis-panel.constructor");
  }

  // helper function to open a graph using the graph-button block
  openAnalysisGraph(graphType: GraphType): void {
    this.currentGraphType = graphType;
  }

  closeAnalysisGraph() {
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
  getCurrentJoint(){
    let currentJointInteractor = this.interactorService.getSelectedObject();
    return (currentJointInteractor as JointInteractor).getJoint();
  }
  getJointName(): string {return this.getCurrentJoint().name;}

  // get x coord and y coord return the number of the currently selected coord
  getJointXCoord(): number {return this.getCurrentJoint().coords.x.toFixed(3) as unknown as number;}
  getJointYCoord(): number {return this.getCurrentJoint().coords.y.toFixed(3) as unknown as number;}
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
