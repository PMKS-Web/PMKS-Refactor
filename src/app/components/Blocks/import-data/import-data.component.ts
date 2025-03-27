import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {Link} from "../../../model/link";
import {PositionSolverService} from "../../../services/kinematic-solver.service";
import {AnalysisSolveService} from "../../../services/analysis-solver.service";
import {Coord} from "../../../model/coord";
import { AnimationPositions } from '../../../services/kinematic-solver.service';
//import Papa from 'papaparse';
import {join} from "@angular/compiler-cli";
import {StateService} from "../../../services/state.service";




@Component({
  selector: 'import-data',
  templateUrl: './import-data.component.html',
  styleUrls: ['./import-data.component.scss'],
})
export class ImportDataComponent {
  @Input() dynamicText: string = '';
  @Input() graphText: string = '';
  @Input() btn1Action!: () => void;

  constructor(private positionSolver: PositionSolverService, private analysisSolverService: AnalysisSolveService,
              private stateService: StateService) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.readAndProcessFile(file);
    }
  }
  readAndProcessFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const csvData = reader.result as string;
      //this.processCSVData(csvData);
    };
    reader.readAsText(file);
  }

  /*
  processCSVData(csvData: string) {

    // Parse CSV data using Papaparse or any other CSV parsing library
    const parsedData = Papa.parse(csvData, { header: true });

    console.log(parsedData.data);
    let currentMechanism = this.stateService.getMechanism();
    let allJoints = currentMechanism.getJoints();
    for(let joint of allJoints){
      currentMechanism.removeJoint(joint.id);
    }

    let startRow = parsedData.data[0];
    console.log(startRow);



  }
*/
  importData() {
    // Trigger file input click programmatically
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.addEventListener('change', (event) => this.onFileSelected(event));
    fileInput.click();
  }

}
