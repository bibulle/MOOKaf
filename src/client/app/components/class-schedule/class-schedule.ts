import {Component, Input, EventEmitter, Output} from "@angular/core";
import {Router} from "@angular/router";
import {Logger} from "angular2-logger/core";
import {Formation} from "../../models/formation";

@Component({
  moduleId: module.id,
  selector: 'class-schedule',
  templateUrl: 'class-schedule.html',
  styleUrls: ['class-schedule.css']
})

export class ClassScheduleComponent {

  @Input()
  formation: Formation;

  @Output()
  notifySelectedPart: EventEmitter<number[]> = new EventEmitter<number[]>();

  selectedPart = "0";
  openedPart = "";

  constructor(public router: Router,
              private _logger: Logger) {

  }

  ngOnInit() {
      this.notifySelectedPart.emit([0]);
  }

  selectPart(event, level1, level2) {
    event.stopPropagation();
    this._logger.info("selectPart "+level1+" "+level2);

    this.selectedPart = level1 + (level2 != null ? "."+level2 : "");
    this.notifySelectedPart.emit([level1, level2]);

    this.openPart(event, level1, level2);

  }

  openPart(event, level1, level2) {
    event.stopPropagation();
    this._logger.info("openedPart "+level1+" "+level2);

    if (this.isOpened(level1, level2)) {
      this.openedPart = "";
    } else {
      this.openedPart = level1 + (level2 != null ? "."+level2 : "");
    }
  }

  isOpened(level1,level2) {
    return (this.openedPart.startsWith(level1 + (level2 != null ? "."+level2 : "")));
  }
  isSelected(level1,level2) {
    return (this.selectedPart == level1 + (level2 != null ? "."+level2 : ""));
  }
}
