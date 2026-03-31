import { TestBed } from '@angular/core/testing';
import {AnalysisSolveService, JointAnalysis} from './analysis-solver.service';
import { PositionSolverService } from './kinematic-solver.service';
import { create, all } from 'mathjs';

const math = create(all, {});

describe('AnalysisSolveService getAngularVelocities', () => {
  let service: AnalysisSolveService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PositionSolverService, useValue: {} },
        AnalysisSolveService,
      ],
    });

    service = TestBed.inject(AnalysisSolveService);
  });

  const deg2rad = (deg: number) => deg * Math.PI / 180;

  const r2 = 2.954;  // AB
  const r3 = 5.752;  // BC
  const r4 = 3.745;  // CD

  it('computes correct ω3 and ω4 for time = 0', () => {
    // Row:
    // 0   80.0594   1.0472   -168.1626   -0.1401   95.0559   0.7726

    const theta2 = deg2rad(80.0594);    // AB angle
    const theta3 = deg2rad(-168.1626);  // CB angle
    const theta4 = deg2rad(95.0559);    // DC angle
    console.log('theta2: ' +theta2);
    console.log('theta3: ' +theta3);
    console.log('theta4: ' +theta4);
    const omega2 = 1.0472;

    const [omega3, omega4] = service.getAngularVelocities(
      r2, r3, r4,
      theta2, theta3, theta4,

      omega2
    );

    console.log('t=0  ω3, ω4 =', omega3, omega4);

    // From table: CB = -0.1401 rad/s, DC = 0.7726 rad/s
    expect(omega3).toBeCloseTo(-0.1401, 4);
    expect(omega4).toBeCloseTo(0.7726, 4);
  });


});
