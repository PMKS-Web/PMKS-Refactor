# PMKS
![Github Hero](https://github.com/PMKS-Web/PMKSWeb/assets/19924289/02b57e93-5421-47e0-92fc-b24798eb6867)

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.1.

## Development Setup

For development, we recommend using WebStorm, a powerful IDE ideal for JavaScript development. It is free for students and faculty members with a .edu email. You can download it [here](https://www.jetbrains.com/community/education).

### Steps to Set Up the Development Environment

1. **Download & Install WebStorm**: Visit the [WebStorm site](https://www.jetbrains.com/community/education) and download the software. Remember to register with your .edu email to get it for free.

2. **Clone the Repository**: Using WebStorm, clone the PMKS+ repository to your local machine.

3. **Install Node JS**: https://nodejs.org/en/download

3. **Install Dependencies**: The necessary dependencies should automatically install when the repository is cloned. If any dependencies are missing, you can run `npm install` to add them.

4. **Set Up Run Configurations**: Create two run configurations in WebStorm:

- *First Configuration*: A npm configuration that runs 'npm start'.
- *Second Configuration*: A JavaScript Debug configuration with the URL set to `http://localhost:4200`. This allows you to run a locally hosted test site on port 4200 and use breakpoints and the debugger to identify errors.

5. **Angular DevTools**: We recommend using the Angular DevTools extension for your browser (available for both [Chrome](https://chrome.google.com/webstore/detail/angular-devtools/ienfalfjdbdpebioblfackkekamfmbnh?hl=en) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/angular-devtools/)). This tool provides additional functionality for debugging and optimizing your Angular applications.

With these steps, you should have a fully functional development environment for PMKS+. Happy coding!

## Coding Guidelines and Workflow

We encourage high code quality and strive for clean, readable, and maintainable code. Here are some general practices we follow:

1. **Code Purposefully**: Code should be written in a simple, obvious style with descriptive variable and function names. Avoid commenting code to explain _how_ it works; instead, code should be written in a way that is inherently understandable. Use comments to explain _why_—to describe high-level behavior and its importance.

2. **Keep Code Short**: Try to keep classes under 200 lines of code if possible and functions short. This prevents the emergence of "god" classes that can make the codebase difficult to maintain.

3. **Good OOP Practices**: Follow principles like SOLID, DRY, and prefer composition over inheritance. If complex relationships seem necessary, reach out first so we can discuss the best approach.

4. **Follow Programming Conventions**:
- File names should always be dash-delimited, with dots being used to denote the “type” of the file. For example: `currency-converter.pipe.ts1`
- All service classes should end with the term `Service`. For example: `HeroService1`
- Selectors for your components should always be dash-delimited, like files, and contain the appropriate app prefix. For example: `app-hero-list`
- The name of a component class should end with `Component`. For example: `HeroListComponent`
- The name of a directive class should end with `Directive`. For example: `HighlightDirective`
- The name of a module class should end with `Module`. For example: `AppModule2`
- The name of a pipe class should be in `PascalCase` and end with `Pipe`. For example: `CurrencyConverterPipe2`
- For more details, check out [Angular's offical coding style guide](https://angular.io/guide/styleguide).

While the codebase may not always perfectly adhere to these conventions, the aim is to continually improve the codebase to meet these standards.

### Workflow

We follow an agile scrum-style workflow, using an issue tracker (Kanban board) in our GitHub organization [here](https://github.com/orgs/PMKS-Web/projects/1).

The process is as follows:

1. Create a fork for each issue you work on.
2. Once you've resolved an issue in your fork, submit a pull request to the main branch.

Please note, the main branch has a CI/CD workflow setup that will update the production website, so nothing should be pushed directly to the main branch!

The commits to the main branch will get reflected on [app.pmksplus.com](https://app.pmksplus.com)

All other branches will get published to https://[BRANCHNAME]--pmks.netlify.app (For example https://staging--pmks.netlify.app)

Landing Page: https://pmksplus.com



This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.1.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Licensing

PMKS+ is licensed under the [MIT License](https://opensource.org/licenses/MIT), a popular, permissive open-source license. The full license text is included in the LICENSE file in this repository.

## Contact

For any queries, you can reach out to the development team at gr-pmksplus@wpi.edu.

## Acknowledgements

PMKS+ is based on PMKS, developed by Prof. Matthew I. Campbell, Professor, Mechanical Engineering, Oregon State University.

### Contributors
- David Peterson (CS '28)
- Randy Gomez (CS '28)
- Huy Ho (CS '27)
- Jeremy Bornstein (CS '25)
- Jagruti Chitte (CS '25)
- Gabriel Curet-Irizarry (CS '25)
- Javier DeLeon (CS '25)
- Matthew Gatta (CS '25)
- Sebastian Gurgol (CS '25)
- Jessica M. Rhodes (BS/MS RBE '25)
- Ansel Chang (CS '25)
- Jacob Adamsky (CS' 24)
- Kohmei Kadoya (BS/MS RBE '23)
- Alex Galvan (BS ME/RBE ’21)
- Haofan Zhang (BS/MS CS ’20)
- Trevor Dowd (BS CS ’20)
- Robert Dutile (BS CS ’20)
- Milap Patel (BS ME/CS ’20)
- Michael Taylor (BS CS ’19)
- Griffin Cecil (BS CS ’19)
- Dimitrios Tsiakmakis (BS CS ’19)
- Praneeth Appikatla (BS CS ’19)
- Peter Prygocki (BS CS ’20)
- Fabian Gaziano (BS CS '20)
- Zhihao Xie (BS RBE '19)
- Albert Nana Beka (BS/MS ME '19)
- Jonathan Andrews (BS RBE ’18)
- Brandon Knox (BS RBE ’18)
- Guillermo Rivera (BS RBE ’18)
- Brad Leach (BS ME ’18)
- Garrett Holman (BS ME ’18)
- Oluchukwu Okafor (BS ME ’18)
- Adel Benchemam (Massachusetts Academy of Math and Science '26)
- Lucas Panta (Worcester Technical High School '25)
- Naseem Blount (Worcester Technical High School '25)

### Faculty

- Prof. David Brown (CS)
- Prof. Pradeep Radhakrishnan (ME, RBE)
