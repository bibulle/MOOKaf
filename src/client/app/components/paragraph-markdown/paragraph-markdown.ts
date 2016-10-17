import {Component, OnInit, Input} from '@angular/core';
import {Subject} from "rxjs/Subject";
//import {Logger} from "angular2-logger/core";

import {Paragraph} from "../../models/paragraph";
import {ParagraphAbstract} from "../paragraph/paragraph-abstract";
import {NotificationService} from "../../services/notification.service";
import {Logger} from "angular2-logger/core";
import {CourseService} from "../../services/course.service";
import {VisibilityEvent} from "../../directives/visible-directive";

@Component({
  moduleId: module.id,
  selector: 'paragraph-markdown',
  //inputs: [ 'data' ],
  templateUrl: 'paragraph-markdown.html',
  styleUrls: ['../paragraph/paragraph.css', 'paragraph-markdown.css']
})

export class ParagraphMarkdownComponent extends ParagraphAbstract implements OnInit {

  html: string = "";

  // for previous value in the editor
  private _previousValue = "";


  constructor(_courseService: CourseService,
              _logger: Logger,
              _notificationService: NotificationService) {
    super(
      _courseService,
      _logger,
      _notificationService
    );

  }

  ngOnInit() {
    super.ngOnInit();
    //this._logger.debug(this.data);


  }

  /**
   * Prepare data to be rendered
   */
  prepareData(): void {
    if (this.data && this.data.content) {
      this.html = ParagraphAbstract.markdownToHTML(this.data.content.toString());
      this._previousValue = this.data.content.toString();
    }
  }


  /**
   * The editor field has been changed
   */
  editorChange() {
    if (this._previousValue !== this.data.content.toString()) {
      this._previousValue = this.data.content.toString();
      this.html = ParagraphAbstract.markdownToHTML(this.data.content.toString());
      this.subjectEditor
        .next(this.data);
    }
  }

  /**
   * THis markdown visibility change... has it been seen ?
   * @param event
   */
  visibilityChange(event:VisibilityEvent) {
    //this._logger.debug("visibilityChange");

    // Is it visible ?
    if (event.bottomVisible) {

      this.setParagraphAsDone();

    }
  }



}
