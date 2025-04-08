import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import {MatExpansionModule} from '@angular/material/expansion';

@Component({
  selector: 'app-analysis-panel',
  templateUrl: './analysis-panel.component.html',
  styleUrls: ['./analysis-panel.component.scss'],

})
export class AnalysisPanelComponent {
  constructor(private interactionService: InteractionService){}
  getSelectedObjectType(): string{
    let obj = this.interactionService.getSelectedObject();
    if(obj == undefined){
      return '';
    } else{
      return obj.type();
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
