import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { Chart, ChartOptions, Plugin, ChartDataset } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';
import { AnimationService } from 'src/app/services/animation.service';

interface ChartDataInput {
  data: number[];
  label: string;
  [key: string]: any;
}

const VERTICAL_LINE_PLUGIN: Plugin = {
  id: 'verticalLine',
  afterDatasetsDraw: (chart: Chart) => {
    const { ctx, scales: { x }, chartArea } = chart;
    const currentStep = (chart as any).currentTimeStep;
    
    if (typeof currentStep !== 'number') return;
    
    const xPos = x.getPixelForValue(currentStep);
    if (xPos === undefined) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xPos, chartArea.top);
    ctx.lineTo(xPos, chartArea.bottom);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

@Component({
  selector: 'app-analysis-graph-block',
  templateUrl: './graph-section.component.html',
  styleUrls: ['./graph-section.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphSectionComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() inputXData: ChartDataInput[] = [{ data: [], label: 'X Position' }];
  @Input() inputYData: ChartDataInput[] = [{ data: [], label: 'Y Position' }];
  @Input() inputLabels: string[] = [];
  @Input() view: [number, number] = [700, 400];
  @Input() colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
  @Input() gradient = false;
  @Input() showLegend = true;
  @Input() showXAxis = true;
  @Input() showYAxis = true;
  @Input() xAxisLabel = 'Time in Time Steps';
  @Input() yAxisLabel = '';

  @ViewChild('graphCanvas', { static: true }) private graphCanvas!: ElementRef<HTMLCanvasElement>;

  chart?: Chart;
  showGrid = false;
  
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly animationService: AnimationService) {}

  ngOnInit(): void {
    this.subscribeToAnimationService();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const dataChanges = ['inputXData', 'inputYData', 'inputLabels'];
    if (this.chart && dataChanges.some(key => changes[key])) {
      this.updateChartData();
    }
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chart?.destroy();
  }

  private subscribeToAnimationService(): void {
    this.animationService.currentFrameIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe(step => this.updateGraphAtStep(step));
  }

  private get chartOptions(): ChartOptions {
    return {
      responsive: true,
      animation: false,
      hover: { mode: 'nearest' },
      elements: {
        point: { radius: 0 },
        line: {
          borderWidth: 3,
          borderDash: [],
          fill: false,
          borderCapStyle: 'round',
          borderJoinStyle: 'round'
        }
      },
      interaction: {
        intersect: false
      },
      scales: {
        x: {
          display: this.showXAxis,
          title: {
            display: this.showXAxis,
            text: this.xAxisLabel,
            color: 'black',
            font: { weight: 'bold' }
          },
          grid: { display: this.showGrid }
        },
        y: {
          display: this.showYAxis,
          title: {
            display: this.showYAxis,
            text: this.yAxisLabel,
            color: 'black',
            font: { weight: 'bold' }
          },
          grid: { display: this.showGrid },
        }
      },
      plugins: {
        legend: { display: false }
      }
    };
  }

  private get chartDatasets(): ChartDataset<'line'>[] {
    return [...(this.inputXData || []), ...(this.inputYData || [])];
  }

  private createChart(): void {
    if (!this.graphCanvas?.nativeElement) return;

    const ctx = this.graphCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.inputLabels,
        datasets: this.chartDatasets
      },
      options: this.chartOptions,
      plugins: [VERTICAL_LINE_PLUGIN]
    });
  }

  private updateChartData(): void {
    if (!this.chart) return;

    this.chart.data.labels = this.inputLabels;
    this.chart.data.datasets = this.chartDatasets;
    this.chart.update('none');
  }

  private updateGraphAtStep(step: number): void {
    if (!this.chart) return;

    (this.chart as any).currentTimeStep = step;
    this.chart.update('none');
  }

  onToggleGrid(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.showGrid = target.checked;
    
    if (this.chart) {
      this.chart.destroy();
      this.createChart();
    }
  }

  downloadCSV(): void {
    if (!this.inputLabels?.length || !this.inputXData?.length || !this.inputYData?.length) return;

    const rows = ['Time,X Data,Y Data'];
    const maxLength = Math.max(
      this.inputLabels.length,
      this.inputXData[0]?.data?.length || 0,
      this.inputYData[0]?.data?.length || 0
    );

    for (let i = 0; i < maxLength; i++) {
      const time = this.inputLabels[i] || '';
      const xData = this.inputXData[0]?.data[i] ?? '';
      const yData = this.inputYData[0]?.data[i] ?? '';
      rows.push(`${time},${xData},${yData}`);
    }

    this.downloadFile(rows.join('\n'), 'graph_data.csv', 'text/csv');
  }

  downloadPNG(): void {
    if (!this.chart) return;

    const canvas = this.chart.canvas;
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    
    if (!ctx) return;

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    // Temporarily hide vertical line
    const currentStep = (this.chart as any).currentTimeStep;
    delete (this.chart as any).currentTimeStep;
    this.chart.update('none');

    // Draw chart
    ctx.drawImage(canvas, 0, 0);

    // Restore vertical line
    if (currentStep !== undefined) {
      (this.chart as any).currentTimeStep = currentStep;
      this.chart.update('none');
    }

    // Download
    exportCanvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.downloadFile(url, 'graph.png', 'image/png', true);
        URL.revokeObjectURL(url);
      }
    });
  }

  private downloadFile(content: string, filename: string, mimeType: string, isBlob = false): void {
    const link = document.createElement('a');
    link.href = isBlob ? content : `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
    link.download = filename;
    link.click();
  }
}