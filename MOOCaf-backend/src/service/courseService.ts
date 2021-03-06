import * as _ from 'lodash';

import Course from "../models/course";
import { ICourse } from "../models/iCourse";
import User = require("../models/user");
import { ICoursePart } from "../models/iCoursePart";
import { IParagraph } from "../models/iParagraph";
import UserCourse = require("../models/UserCourse");
import IUserPart = require("../models/iUserParts");
import UserChoice = require("../models/userChoice");
import IUserChoices = require("../models/iUserChoices");
import { ParagraphType } from "../models/eParagraphType";

const debug = require('debug')('server:service:course');

export default class CourseService {


  static getCourses (userId: string, currentOnly: boolean, progressOnly: boolean): Promise <ICourse[]> {

    return new Promise<ICourse[]>((resolve, reject) => {
      Course.find()
            .then((courses: ICourse[]) => {
              //debug(courses);
              // Search the user
              User.findById(userId)
                  .then(user => {
                    // fill each paragraph with users values
                    const promises = _.map(courses,
                      p => CourseService.fillCourseForUser(p, user));
                    Promise.all(promises)
                           .then((completedCourses: ICourse[]) => {

                             // filter if we only need the currents one
                             if (currentOnly) {
                               completedCourses = completedCourses
                                 .filter(f => {
                                   return (f.dateFollowed && !f.dateFollowedEnd)
                                 })
                             } else if (progressOnly) {
                               completedCourses = completedCourses
                                 .filter(f => {
                                   return (f.dateFollowed)
                                 })
                             }

                             resolve(completedCourses);
                           })
                           .catch(err => {
                             reject(err);
                           });
                  })
                  .catch(err => {
                    reject(err);
                  });
            })
            .catch(err => {
              reject(err);
            });
    });
  }


  /**
   * fill course with user data
   * @param course
   * @param user (from Db, not from token... should be full)
   * @returns {Promise<Course>}
   * @private
   */
  static fillCourseForUser (course: Course, user: User): Promise < Course > {
    //debug("fillCourseForUser : " + course["id"] + ", " + user["id"]);


    return new Promise < Course >((resolve, reject) => {


      // as every course go there before being sen did just some verification
      // if no page... add one
      if (!course.parts) {
        course.parts = [];
      }
      if (course.parts.length == 0) {
        course.parts.push(new ICoursePart({
          title: "Not yet defined",
          parts: [],
          contents: []
        }));
        course.parts[0].contents = [
          new IParagraph({
            type: ParagraphType.MarkDown,
            content: ""
          })
        ];
        // Save the course
        Course
          .updateOrCreate(course)
          .then(course => {
            //debug(course);
            CourseService.fillCourseForUser(course, user)
                         .then(course => {
                           resolve(course);
                         })
                         .catch(err => {
                           reject(err);
                         });
          })
          .catch(err => {
            console.log(err);
            reject(err);
          })
      } else {

        // define the default values
        let isFavorite = false;
        let interest = 0;
        let dateSeen: Date = null;
        let isNew = null;
        let dateFollowed = null;
        let dateFollowedEnd = null;
        let percentFollowed = 0;

        // get values from the user
        if (user && user.courses && user.courses[course["id"]]) {
          isFavorite = user.courses[course["id"]].isFavorite;
          interest = user.courses[course["id"]].interest;
          dateSeen = user.courses[course["id"]].dateSeen;
          isNew = user.courses[course["id"]].new;
          dateFollowed = user.courses[course["id"]].dateFollowed;
          dateFollowedEnd = user.courses[course["id"]].dateFollowedEnd;
          percentFollowed = user.courses[course["id"]].percentFollowed;

          if (dateSeen && isNew) {
            isNew = ((dateSeen == null) || ((new Date().getTime() - dateSeen.getTime()) < 1000 * 60));
          }

          // add user choices for the paragraphs
          if (user.courses[course["id"]].userChoices) {
            _.forIn(user.courses[course["id"]].userChoices, (value, paragraphId) => {
              let paragraph = CourseService.searchParagraphById(paragraphId, course.parts);
              if (paragraph) {
                //console.log(p);
                paragraph.userChoice = value.userChoice;
                paragraph.userCheckCount = value.userCheckCount;
                paragraph.userCheckOK = value.userCheckOK;
                paragraph.userDone = value.userDone;
                paragraph.userChoiceReturn = value.userChoiceReturn;

                // remove the answer to not spoil !!
                if (!user.isAdmin && (value.userCheckCount == null) || (value.userCheckCount < paragraph.maxCheckCount)) {
                  paragraph.answer = null;
                }
              }
            })
          }

          // add user things about parts
          if (user.courses[course["id"]].userParts) {
            _.forIn(user.courses[course["id"]].userParts, (value, partId) => {
              let part = CourseService.searchPartById(partId, course.parts);
              if (part) {
                //console.log(p);
                part.lastDone = value.lastDone;
                part.percentFollowed = (value.countRead + value.countCheckOk + value.countCheckKo) / value.countParagraph;
                part.countRead = value.countRead;
                part.countCheckOk = value.countCheckOk;
                part.countCheckKo = value.countCheckKo;
                part.countParagraph = value.countParagraph;
              }
            })
          }
        }

        // assign the values into the course
        _.assign(course, {
          isFavorite: isFavorite,
          interest: interest,
          dateSeen: dateSeen,
          'new': isNew,
          dateFollowed: dateFollowed,
          dateFollowedEnd: dateFollowedEnd,
          percentFollowed: percentFollowed,
          id: course['_id']
        });

        resolve(course);

      }
    })
  }

  /**
   * Search for a paragraph within course parts
   * @param paragraphId
   * @param courseParts
   * @returns  the searched paragraph
   */
  static  searchParagraphById (paragraphId: string, courseParts: ICoursePart[]): IParagraph {

    let returnedParagraph: IParagraph = null;

    if (courseParts == null) {
      return null;
    }

    courseParts.forEach(part => {
      if (part.contents != null) {
        part.contents.forEach(para => {
          if (paragraphId == para['_id']) {
            returnedParagraph = para;
          }
        });
      }
      if (returnedParagraph == null) {
        returnedParagraph = CourseService.searchParagraphById(paragraphId, part.parts);
      }
    });

    return returnedParagraph;

  }

  /**
   * Search for a paragraph within course parts
   * @param paragraphNums
   * @param courseParts
   * @returns  the searched paragraph
   */
  static searchParagraphByPath (paragraphNums: number[], courseParts: ICoursePart[]): IParagraph {

    let part = CourseService.searchPartByPath(paragraphNums.slice(0, -1), courseParts);

    let paraIndex = paragraphNums[paragraphNums.length - 1];

    return part.contents[paraIndex];
  }

  /**
   * Search for a part within course parts
   * @param partId
   * @param courseParts
   * @returns  the searched paragraph
   */
  static searchPartById (partId: string, courseParts: ICoursePart[]): ICoursePart {

    let returnedPart: ICoursePart = null;

    if (courseParts == null) {
      return null;
    }

    courseParts.forEach(part => {
      if (!returnedPart) {
        if (partId == part['_id']) {
          returnedPart = part;
        } else {
          returnedPart = CourseService.searchPartById(partId, part.parts);
          if (returnedPart) {
          }
        }
      }
    });

    return returnedPart;
  }

  /**
   * Search for a part within course parts
   * @param partNums
   * @param courseParts
   * @returns  the searched paragraph
   */
  static searchPartByPath (partNums: number[], courseParts: ICoursePart[]): ICoursePart {

    let part = courseParts[partNums[0]];
    for (let i = 1; i < partNums.length; i++) {
      part = part.parts[partNums[i]];
    }

    return part;
  }

  /**
   * fill or init a user course with coming user choices
   * @param userCourse
   * @param courseId
   * @param userId
   * @param paragraphId
   * @param userChoice
   * @returns {UserCourse}
   */
  static initOrFillUserCourse (userCourse: UserCourse, courseId: string, userId: string, paragraphId: string, userChoice: UserChoice) {
    // Init user choice if needed
    if (userCourse == null) {
      userCourse = new UserCourse({ courseId: courseId, userId: userId });
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
    return userCourse;
  }


  /**
   * Calc progression and stats for a user
   * @param userCourse
   * @private
   */
  static calcProgression (userCourse: UserCourse): Promise<UserCourse> {

    let courseId = userCourse.courseId;

    if (userCourse.userParts == null) {
      userCourse.userParts = {};
    }

    return new Promise <UserCourse>((resolve, reject) => {
      Course.findById(courseId)
            .then(course => {

              let courseCounts = CourseService._calcProgressionOnParts(course.parts, userCourse);

              // something as been done
              if (courseCounts.lastDone != null) {
                // Let's start the course
                if (!userCourse.dateFollowed) {
                  userCourse.dateFollowed = courseCounts.lastDone;
                }
                // Calculate the percent done
                userCourse.percentFollowed = (courseCounts.countRead + courseCounts.countCheckOk + courseCounts.countCheckKo) / (courseCounts.countParagraph);

                // Let's end it
                if (userCourse.percentFollowed >= 1) {
                  userCourse.dateFollowedEnd = courseCounts.lastDone;
                } else {
                  userCourse.dateFollowedEnd = null;
                }
              }

              resolve(userCourse);
            })
            .catch(err => {
              console.log(err);
              reject("System error " + err);
            });

    });
  }

  private static _calcProgressionOnParts (parts: ICoursePart[], userCourse: UserCourse): IUserPart {

    let ret = new IUserPart();
    ret.countParagraph = 0;
    ret.countCheckOk = 0;
    ret.countCheckKo = 0;
    ret.countRead = 0;


    _.forEach(parts, (part) => {

      let partId = part['_id'];

      // calculate on sub-parts
      userCourse.userParts[partId] = CourseService._calcProgressionOnParts(part.parts, userCourse);


      // add calculation on content
      _.forEach(part.contents, (paragraph) => {

        let paragraphId = paragraph['_id'];

        userCourse.userParts[partId].countParagraph++;

        if (userCourse.userChoices[paragraphId] && userCourse.userChoices[paragraphId].userDone) {
          if (userCourse.userChoices[paragraphId].userCheckOK === true) {
            userCourse.userParts[partId].countCheckOk++;
          } else if (userCourse.userChoices[paragraphId].userCheckOK === false) {
            userCourse.userParts[partId].countCheckKo++;
          } else {
            userCourse.userParts[partId].countRead++;
          }

          if (!userCourse.userParts[partId].lastDone || (userCourse.userParts[partId].lastDone < userCourse.userChoices[paragraphId].userDone)) {
            userCourse.userParts[partId].lastDone = userCourse.userChoices[paragraphId].userDone;
          }
        }
      });

      // add to the parent part
      ret.countParagraph += userCourse.userParts[partId].countParagraph;
      ret.countCheckOk += userCourse.userParts[partId].countCheckOk;
      ret.countCheckKo += userCourse.userParts[partId].countCheckKo;
      ret.countRead += userCourse.userParts[partId].countRead;

      if (!ret.lastDone || (ret.lastDone < userCourse.userParts[partId].lastDone)) {
        ret.lastDone = userCourse.userParts[partId].lastDone;
      }

    });

    // debug(userCourse.userParts);

    return ret;

  }


}
