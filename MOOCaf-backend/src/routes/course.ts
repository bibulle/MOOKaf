import {Router, Response, Request} from "express";
import * as jwt from "express-jwt";
import * as _ from "lodash";
import {secret} from "../config";
var debug = require('debug')('server:routes:course');
import Course from "../models/course";
import User = require("../models/user");
import UserChoice = require("../models/userChoice");
import isUndefined = require("lodash/isUndefined");
import IUserCourse = require("../models/UserCourse");
import IUserChoices = require("../models/iUserChoices");
import Paragraph = require("../models/paragraph");
import {ICoursePart} from "../models/iCoursePart";
import {IParagraph} from "../models/iParagraph";
import UserCourse = require("../models/UserCourse");
import {ParagraphType} from "../models/eParagraphType";
import {ParagraphContentType} from "../models/eParagraphContentType";
import {ICourse} from "../models/iCourse";
import IUserPart = require("../models/iUserParts");
import CourseService from "../service/courseService";
import StatService from "../service/statService";


const courseRouter: Router = Router();

// Add JWT management
var jwtCheck = jwt({
  secret: secret
});
//noinspection TypeScriptValidateTypes
courseRouter.use(jwtCheck);

// -----------------------------------
// --     /api/course routes     --
// -----------------------------------


// ====================================
// route getting for all courses
// ====================================
courseRouter.route('/')
  .get((request: Request, response: Response) => {
    //debug("GET /");
    //debug("connected user : " + JSON.stringify(request['user']));

    var currentOnly = false;
    var progressOnly = false;
    if (request.query['currentOnly']) {
      currentOnly = (request.query['currentOnly'] === "true");
    }
    if (request.query['progressOnly']) {
      progressOnly = (request.query['progressOnly'] === "true");
    }

    CourseService.getCourses(request['user']["id"], currentOnly, progressOnly)
      .then((completedCourses: ICourse[]) => {
          response.json({data: completedCourses});
        }
      )
      .catch(err => {
        console.log(err);
        response.status(500).send("System error " + err);
      });
  });

courseRouter.route('/:course_id')
// ====================================
// route for getting one course
// ====================================
  .get((request: Request, response: Response) => {
    //debug("GET /" + request.params.course_id);
    let courseId = request.params['course_id'];
    //debug("connected user : " + JSON.stringify(request['user']));

    _respondWithCourse(courseId, request['user']["id"], response);

  })

  // ====================================
  // update a course
  // ====================================
  .put((request: Request, response: Response) => {

    var course = new Course(request.body);
    //debug(course);
    //debug("PUT /" + request.params.course_id);

    Course.updateOrCreate(course)
      .then(course => {
        if (course) {
          response.json({data: course});
        } else {
          response.status(404).json({status: 404, message: "Course not found"});
        }
      })
      .catch(err => {
        console.log(err);
        response.status(500).send("System error " + err);
      });

  });


courseRouter.route('/:course_id/userValues')
// ====================================
// update user values for a course
// ====================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];

    debug("PUT /" + courseId + "/userValues");

    // console.log("0-----");
    // debug(request.body);
    var userCourse = new IUserCourse(request.body);

    userCourse.userId = request['user']["id"];
    userCourse.courseId = courseId;

    // debug(userCourse);

    UserCourse.updateOrCreate(userCourse)
      .then(() => {
        // debug(userCourse);

        StatService.calcStatsUser(request['user']["id"]);

        _respondWithCourse(courseId, request['user']["id"], response);

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/para/:paragraphNums')
// ============================================
// update a course paragraph
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var paragraphNums = JSON.parse("[" + request.params['paragraphNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/para/" + paragraphNums);
    //debug(request.body);

    var paragraph = new IParagraph(request.body);
    //debug(paragraph);

    // TODO : Add a check of user right

    // Search the userValues
    Course
      .findById(courseId)
      .then(course => {
        //debug(userCourse);
        //debug(userCourse.userChoices[paragraphId]);

        let part = CourseService.searchPartByPath(paragraphNums.slice(0, -1), course.parts);
        part.contents = part.contents || [];

        let paraIndex = paragraphNums[paragraphNums.length - 1];

        if (paragraph['_id'] == null) {
          // new para, add it
          part.contents.splice(paraIndex, 0, paragraph);
        } else {
          // replace the para
          part.contents.splice(paraIndex, 1, paragraph);
        }

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCourseParagraph(courseId, paragraph['_id'], paragraphNums, userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  })
  // ============================================
  // remove a course paragraph
  // ============================================
  .delete((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var paragraphNums = JSON.parse("[" + request.params['paragraphNums'] + "]");
    var userId = request['user']["id"];

    debug("DEL /" + courseId + "/para/" + paragraphNums);

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        let parentPartNums = paragraphNums.slice(0, -2);

        let parentParts = course.parts;
        if (parentPartNums.length > 0) {
          parentParts = CourseService.searchPartByPath(parentPartNums, parentParts).parts;
        }
        let parentPart = parentParts[paragraphNums[paragraphNums.length - 2]];
        let paraIndex = paragraphNums[paragraphNums.length - 1];

        // remove the para
        parentPart.contents.splice(paraIndex, 1);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCoursePart(courseId, null, paragraphNums.slice(0, -1), userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/para/:srcParaNums/move')
// ============================================
// move a course paragraph
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var srcParaNums = JSON.parse("[" + request.params['srcParaNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/para/" + srcParaNums + "/move");
    //debug(request.body);

    var trgParaNum = request.body['trgParaNum'];
    //debug(trgParaNum);

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        // calculate src
        let srcParentPartNums = srcParaNums.slice(0, -2);
        let srcParentParts = course.parts;
        if (srcParentPartNums.length > 0) {
          srcParentParts = CourseService.searchPartByPath(srcParentPartNums, srcParentParts).parts;
        }
        let srcParentPart = srcParentParts[srcParaNums[srcParaNums.length - 2]];
        let srcParaIndex = srcParaNums[srcParaNums.length - 1];

        // calculate trg
        let trgParaIndex = trgParaNum;

        // remove the para from the src
        let paragraph = srcParentPart.contents.splice(srcParaIndex, 1)[0];

        // add the part to the trg
        srcParentPart.contents.splice(trgParaIndex, 0, paragraph);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCoursePart(courseId, null, srcParaNums.slice(0, -1), userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/para/:trgParaNums/add')
// ============================================
// add a course paragraph
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var trgParaNums = JSON.parse("[" + request.params['trgParaNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/para/" + trgParaNums + "/add");
    //debug(request.body);

    let type: ParagraphType = request.body.type;
    let subType: ParagraphContentType = request.body['subType'];

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        // calculate trg
        let trgParentPartNums = trgParaNums.slice(0, -2);
        if (course.parts == null) {
          course.parts = [];
        }
        let trgParentParts = course.parts;
        if (trgParentPartNums.length > 0) {
          let part = CourseService.searchPartByPath(trgParentPartNums, trgParentParts);
          if (part.parts == null) {
            part.parts = [];
          }
          trgParentParts = part.parts;
        }
        if (trgParentParts == null) {
          trgParentParts = [];
        }
        let trgParentPart = trgParentParts[trgParaNums[trgParaNums.length - 2]];
        let trgParaIndex = trgParaNums[trgParaNums.length - 1];

        // create a new paragraph
        let paragraph: IParagraph;
        if (type == ParagraphType.MarkDown) {
          paragraph = new IParagraph({
            type: type,
            content: 'content'
          });
        } else if (subType == ParagraphContentType.Text) {
          paragraph = new IParagraph({
            type: type,
            content: {
              type: subType,
              label: 'Title',
              question: 'Question',
            },
            maxCheckCount: 3,
            answer: 'answer'
          });
        } else if (subType == ParagraphContentType.Radio) {
          paragraph = new IParagraph({
            type: type,
            content: {
              type: subType,
              label: 'Title',
              questions: ['Choice 1', 'Choice 2'],
            },
            maxCheckCount: 3,
            answer: 0
          });
        } else {
          paragraph = new IParagraph({
            type: type,
            content: {
              type: subType,
              label: 'Title',
              questions: ['Choice 1', 'Choice 2'],
            },
            maxCheckCount: 3,
            answer: [0]
          });
        }

        //debug(paragraph);

        // add the part to the trg
        trgParentPart.contents.splice(trgParaIndex, 0, paragraph);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCoursePart(courseId, null, trgParaNums.slice(0, -1), userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/part/:partNums')
// ============================================
// update a course part (a page)
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var partNums = JSON.parse("[" + request.params['partNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/part/" + partNums);
    //debug(request.body);

    var coursePart = new ICoursePart(request.body);
    //(coursePart);

    // TODO : Add a check of user right

    // Search the userValues
    Course
      .findById(courseId)
      .then(course => {

        let parentPartNums = partNums.slice(0, -1);

        let parentParts = course.parts;
        if (parentPartNums.length > 0) {
          parentParts = CourseService.searchPartByPath(parentPartNums, parentParts).parts;
        }

        let partIndex = partNums[partNums.length - 1];

        if (coursePart['_id'] == null) {
          // new page, add it
          parentParts.splice(partIndex, 0, coursePart);
        } else {
          // replace the page
          parentParts.splice(partIndex, 1, coursePart);
        }

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCoursePart(courseId, coursePart['_id'], partNums, userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  })
  // ============================================
  // remove a course part (a page)
  // ============================================
  .delete((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var partNums = JSON.parse("[" + request.params['partNums'] + "]");
    var userId = request['user']["id"];

    debug("DEL /" + courseId + "/part/" + partNums);

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        let parentPartNums = partNums.slice(0, -1);

        let parentParts = course.parts;
        if (parentPartNums.length > 0) {
          parentParts = CourseService.searchPartByPath(parentPartNums, parentParts).parts;
        }

        let partIndex = partNums[partNums.length - 1];

        // remove the part
        parentParts.splice(partIndex, 1);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCourse(courseId, userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/part/:srcPartNums/move')
// ============================================
// move a course part (a page)
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var srcPartNums = JSON.parse("[" + request.params['srcPartNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/part/" + srcPartNums + "/move");
    //debug(request.body);

    var trgPartNums = request.body;
    //debug(trgPartNums);

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        // calculate src
        let srcParentPartNums = srcPartNums.slice(0, -1);
        let srcParentParts = course.parts;
        if (srcParentPartNums.length > 0) {
          srcParentParts = CourseService.searchPartByPath(srcParentPartNums, srcParentParts).parts;
        }
        let srcPartIndex = srcPartNums[srcPartNums.length - 1];

        // calculate trg
        let trgParentPartNums = trgPartNums.slice(0, -1);
        let trgParentParts = course.parts;
        if (trgParentPartNums.length > 0) {
          trgParentParts = CourseService.searchPartByPath(trgParentPartNums, trgParentParts).parts;
        }
        let trgPartIndex = trgPartNums[trgPartNums.length - 1];

        // remove the part from the src
        let coursePart = srcParentParts.splice(srcPartIndex, 1)[0];

        // add the part to the trg
        trgParentParts.splice(trgPartIndex, 0, coursePart);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCourse(courseId, userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/part/:trgPartNums/add')
// ============================================
// add a course part (a page)
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var trgPartNums = JSON.parse("[" + request.params['trgPartNums'] + "]");
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/part/" + trgPartNums + "/add");
    //debug(request.body);

    // TODO : Add a check of user right

    // Search the course
    Course
      .findById(courseId)
      .then(course => {

        // calculate trg
        let trgParentPartNums = trgPartNums.slice(0, -1);
        if (course.parts == null) {
          course.parts = [];
        }
        let trgParentParts = course.parts;
        if (trgParentPartNums.length > 0) {
          let part = CourseService.searchPartByPath(trgParentPartNums, trgParentParts);
          if (part.parts == null) {
            part.parts = [];
          }
          trgParentParts = part.parts;
        }
        if (trgParentParts == null) {
          trgParentParts = [];
        }
        let trgPartIndex = trgPartNums[trgPartNums.length - 1];

        // create a new coursePart
        let coursePart = new ICoursePart({
          title: "New page",
          parts: [],
          contents: []
        });

        // add the part to the trg
        trgParentParts.splice(trgPartIndex, 0, coursePart);

        // Save the course
        Course
          .updateOrCreate(course)
          .then(() => {
            //debug(course);
            _respondWithCourse(courseId, userId, response);
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          })

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

courseRouter.route('/:course_id/:paragraph_id/userChoice')
// ============================================
// update user choice for a course paragraph
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var paragraphId = request.params['paragraph_id'];
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/" + paragraphId + "/userChoice");
    //debug(request.body);

    var userChoice = new UserChoice(request.body);
    //debug(userChoice);

    // Search the userValues
    UserCourse.findByUserIdCourseId(userId, courseId)
      .then(userCourse => {
        //debug(userCourse);
        //debug(userCourse.userChoices[paragraphId]);
        if (userCourse == null) {
          userCourse = new UserCourse({courseId: courseId, userId: userId});
        }
        if (userCourse.userChoices == null) {
          userCourse.userChoices = {};
        }
        if (userCourse.userChoices[paragraphId] == null) {
          userCourse.userChoices[paragraphId] = new IUserChoices()
        }

        _.assign(userCourse.userChoices[paragraphId], userChoice);
        if (!userCourse.userChoices[paragraphId].userCheckCount) {
          userCourse.userChoices[paragraphId].userCheckCount = 0;
        }
        userCourse.userChoices[paragraphId].updated = new Date();
        //debug(userCourse.userChoices[paragraphId]);


        CourseService.calcProgression(userCourse)
          .then((userCourse) => {
            UserCourse
              .updateOrCreate(userCourse)
              .then(() => {

                StatService.calcStatsUser(userId);

                _respondWithCourseParagraph(courseId, paragraphId, null, userId, response)
              })
              .catch(err => {
                console.log(err);
                response.status(500).json({status: 500, message: "System error " + err});
              });
          })
          .catch(err => {
            console.log(err);
            response.status(500).json({status: 500, message: "System error " + err});
          });
      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  })
;

courseRouter.route('/:course_id/:paragraph_id/userChoice/check')
// ============================================
// check user choice for a course paragraph
// ============================================
  .put((request: Request, response: Response) => {

    var courseId = request.params['course_id'];
    var paragraphId = request.params['paragraph_id'];
    var userId = request['user']["id"];

    debug("PUT /" + courseId + "/" + paragraphId + "/userChoice/check'");
    //debug(request.body);

    var userChoice = new UserChoice(request.body);
    //debug(userChoice);

    // Search the user Values (to check if check can be done)
    UserCourse
      .findByUserIdCourseId(userId, courseId)
      .then(userCourse => {
        if (userCourse == null) {
          userCourse = new UserCourse({courseId: courseId, userId: userId});
        }
        if (userCourse.userChoices == null) {
          userCourse.userChoices = {};
        }
        if (userCourse.userChoices[paragraphId] == null) {
          userCourse.userChoices[paragraphId] = new IUserChoices()
        }

        _.assign(userCourse.userChoices[paragraphId], userChoice);
        if (!userCourse.userChoices[paragraphId].userCheckCount) {
          userCourse.userChoices[paragraphId].userCheckCount = 0;
        }
        userCourse.userChoices[paragraphId].updated = new Date();
        //debug(userCourse.userChoices[paragraphId]);

        // get the paragraph
        Course.findById(courseId)
          .then(course => {
            let paragraph = CourseService.searchParagraphById(paragraphId, course.parts);
            if (paragraph != null) {
              // check the user choice
              if (paragraph.maxCheckCount <= userCourse.userChoices[paragraphId].userCheckCount) {
                // Too many try, won't be saved
                response.status(401).json({status: 401, message: "Too many try"});
              } else if (userCourse.userChoices[paragraphId].userCheckOK === true) {
                // Answer already correct
                response.status(401).json({status: 401, message: "Answer already correct"});
              } else {
                // Do the check
                userCourse.userChoices[paragraphId].userCheckOK = ("" + userCourse.userChoices[paragraphId].userChoice == "" + paragraph.answer);
                userCourse.userChoices[paragraphId].userCheckCount += 1;
                userCourse.userChoices[paragraphId].updated = new Date();

                // if done, set it
                if ((userCourse.userChoices[paragraphId].userCheckOK === true) || (paragraph.maxCheckCount <= userCourse.userChoices[paragraphId].userCheckCount)) {
                  userCourse.userChoices[paragraphId].userDone = new Date();
                }

                // save it to Db
                CourseService.calcProgression(userCourse)
                  .then((userCourse) => {
                    UserCourse
                      .updateOrCreate(userCourse)
                      .then(() => {

                        StatService.calcStatsUser(userId);

                        _respondWithCourseParagraph(courseId, paragraphId, null, request['user']["id"], response);
                      })
                      .catch(err => {
                        console.log(err);
                        response.status(500).json({status: 500, message: "System error " + err});
                      })
                  })
                  .catch(err => {
                    console.log(err);
                    response.status(500).json({status: 500, message: "System error " + err});
                  })
              }

            } else {
              response.status(404).json({status: 404, message: "Course not found"});
            }
          })
          .catch(err => {
            console.log(err);
            response.status(500).send("System error " + err);
          });

      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  });

/**
 * Get a course (filled) by Id
 * @param courseId
 * @param userId
 * @param response
 * @private
 */
function _respondWithCourse(courseId: string, userId: string, response: Response) {
  //debug("_respondWithCourse : " + courseId + ", " + userId);
  Course.findById(courseId)
    .then(course => {
      // Search the user
      User.findById(userId)
        .then(user => {
          if (course) {
            CourseService.fillCourseForUser(course, user)
              .then(cou => {
                //debug(cou);
                response.json({data: cou})
              })
              .catch(err => {
                console.log(err);
                response.status(500).send("System error " + err);
              });
          } else {
            response.status(404).json({status: 404, message: "Course not found"});
          }
        })
        .catch(err => {
          console.log(err);
          response.status(500).send("System error " + err);
        })
    })
    .catch(err => {
      console.log(err);
      response.status(500).send("System error " + err);
    });

}

/**
 * Get a paragraph (filled) by Id or path
 * @param courseId
 * @param paragraphId
 * @param paragraphNums
 * @param userId
 * @param response
 * @private
 */
function _respondWithCourseParagraph(courseId: string, paragraphId: string, paragraphNums: number[], userId: string, response: Response) {
  //debug("_respondWithCourse : " + courseId + ", " + userId);
  Course.findById(courseId)
    .then(course => {

      // Search the user
      User.findById(userId)
        .then(user => {
          if (course) {
            CourseService.fillCourseForUser(course, user)
              .then(cou => {
                // search for the paragraph
                let para: IParagraph;
                if (paragraphId) {
                  para = CourseService.searchParagraphById(paragraphId, cou.parts);
                } else {
                  para = CourseService.searchParagraphByPath(paragraphNums, cou.parts);
                }

                if (para != null) {
                  response.json({data: para})
                } else {
                  response.status(404).json({status: 404, message: "Course not found"});
                }
              })
              .catch(err => {
                console.log(err);
                response.status(500).send("System error " + err);
              });
          } else {
            response.status(404).json({status: 404, message: "Course not found"});
          }
        })
        .catch(err => {
          console.log(err);
          response.status(500).send("System error " + err);
        })
    })
    .catch(err => {
      console.log(err);
      response.status(500).send("System error " + err);
    });

}

/**
 * Get a course part (filled) by Id or path (nums)
 * @param courseId
 * @param coursePartId
 * @param partNums
 * @param userId
 * @param response
 * @private
 */
function _respondWithCoursePart(courseId: string, coursePartId: string, partNums: number[], userId: string, response: Response) {
  //debug("_respondWithCoursePart : " + courseId + ", " + coursePartId+ ", " + partNums);
  Course.findById(courseId)
    .then(course => {

      // Search the user
      User.findById(userId)
        .then(user => {
          if (course) {
            CourseService.fillCourseForUser(course, user)
              .then(cou => {
                // search for the part
                let part: ICoursePart;
                if (coursePartId) {
                  part = CourseService.searchPartById(coursePartId, cou.parts);
                } else {
                  part = CourseService.searchPartByPath(partNums, cou.parts);
                }

                if (part != null) {
                  response.json({data: part})
                } else {
                  response.status(404).json({status: 404, message: "Page not found"});
                }
              })
              .catch(err => {
                console.log(err);
                response.status(500).send("System error " + err);
              });
          } else {
            response.status(404).json({status: 404, message: "Page not found"});
          }
        })
        .catch(err => {
          console.log(err);
          response.status(500).send("System error " + err);
        })
    })
    .catch(err => {
      console.log(err);
      response.status(500).send("System error " + err);
    });

}



export {courseRouter}




