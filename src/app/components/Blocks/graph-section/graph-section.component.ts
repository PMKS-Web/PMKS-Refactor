import { Component, Input, AfterViewInit, OnInit, ViewChild, ElementRef } from '@angular/core';
import {
  Chart,
  ChartOptions,
  Plugin
} from 'chart.js'


// Add a plugin to the ChartOptions
const verticalLinePlugin: Plugin  = {
  id: 'verticalLine',
  afterDraw: (chart: Chart) => {
    const lineIndex = 1; // Index of the dataset to draw the line on
    const dataset = chart.data.datasets[lineIndex];
    const meta = chart.getDatasetMeta(lineIndex);
    const xAxis = chart.scales['x'];
    console.log('X-axis details:', xAxis);
    console.log('Logging the X Axis!');
    const firstDataPoint = dataset.data[0];

    // Check if firstDataPoint is a number (it could be null)
    if (typeof firstDataPoint === 'number') {
      const yPos = xAxis.getPixelForValue(firstDataPoint);

      // Draw the vertical line
      const ctx: CanvasRenderingContext2D = chart.ctx;
      ctx.beginPath();
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.moveTo(meta.data[0].x, yPos);
      ctx.lineTo(meta.data[0].x, meta.data[meta.data.length - 1].y);
      ctx.stroke();
    }
  },
};

@Component({
  selector: 'app-analysis-graph-block',
  templateUrl: './graph-section.component.html',
  styleUrls: ['./graph-section.component.scss']
})
export class GraphSectionComponent implements AfterViewInit, OnInit {
  @Input() inputXData?: any[] = [{ data: [/* x-values */], label: 'X Position' }];
  @Input() inputYData?: any[] = [{ data: [/* y-values */], label: 'Y Position' }];
  @Input() inputLabels?: string[] = [""]
  @ViewChild('graphCanvas') graphCanvas!: ElementRef;

  @Input() view: [number, number] = [700, 400];
  @Input() colorScheme = {domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']};
  @Input() gradient = false;
  @Input() showLegend = true;
  @Input() showXAxis = true;
  @Input() showYAxis = true;
  @Input() xAxisLabel = 'Time in Time Steps';
  @Input() yAxisLabel = '';

  public chart!: Chart;

  public ChartOptions: any = {
    bezierCurve: true,
    tension: 0.3,
    scaleShowVerticalLines: false,
    responsive: true,
    hover: {
      mode: 'nearest',
    },

    elements: {
      point: {
        radius: 0.5,  // Set a fixed radius for all points in all datasets
      },
    },

    animation: false,
    scales: {
      x: {
        display: this.showXAxis,
        title: {
          display: true,
          text: this.xAxisLabel,
          color: 'black',  // Set the text color to black
          font: {
            weight: 'bold',  // Make the text bold
          },
        },
      },
      y: {
        display: this.showYAxis,
        title: {
          display: true,
          text: this.yAxisLabel,
          color: 'black',  // Set the text color to black
          font: {
            weight: 'bold',  // Make the text bold
          },
        },
        padding: {
          top: 10,  // Add padding as a percentage of the chart height
          bottom: 10,
        },
      },
    },
    legend: this.showLegend,
  };

  ngOnInit() {
    // Ensure the chart is created after the view has been initialized
    if (this.graphCanvas) {
      this.createChart();
    }
  }
  ngAfterViewInit() {
    // Ensure the chart is created after the view has been initialized
    if (this.graphCanvas) {
      this.createChart();
    }
  }

  createChart() {
    const ctx: CanvasRenderingContext2D = this.graphCanvas.nativeElement.getContext('2d');
    console.log("Creating chart!");

    if (this.inputXData && this.inputYData) {
      this.chart = new Chart(ctx, {

        type: 'line',
        data: {
          labels: this.inputLabels,
          datasets: [
            ...this.inputXData,
            ...this.inputYData,
          ]
        },
        options: {
          ...(this.ChartOptions as ChartOptions),
        },
        //plugins: [verticalLinePlugin]
      });
    }
  }


  //Download a csv file
  downloadCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add header row
    csvContent += "Time,X Data,Y Data\n";

    // Ensure data is available
    if (this.inputLabels && this.inputXData && this.inputYData) {
      for (let i = 0; i < this.inputLabels.length; i++) {
        let time = this.inputLabels[i] || "";
        let xData = this.inputXData[0]?.data[i] ?? "";
        let yData = this.inputYData[0]?.data[i] ?? "";

        csvContent += `${time},${xData},${yData}\n`;
      }
    }

    // Create a downloadable link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "graph_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


}
