import db from "./db";
import Mongoose = require("mongoose");
import {IAward, modelIAward} from "./iAward";
var debug = require('debug')('server:model:award');

export default class Award extends IAward {

  /**
   * Constructor
   * @param document
   */
  constructor(document: {}) {
    super(document);
    // modelIAward.on('error', function (err) {
    //   debug("Error : " + err);
    // });
  }


  static count(): Promise<number> {
    //debug("count");
    return new Promise<number>((resolve, reject) => {
      modelIAward.count(
        {},
        (err, count) => {
          //debug("count " + err + " " + count);
          if (err) {
            db.init();
            this.count()
              .then(result => resolve(result))
              .catch(err => reject(err))
          } else {
            resolve(count);
          }
        });
    })
  };

  /**
   * Find the list of awards
   * @returns {Promise<IAward[]>}
   */
  static find(): Promise < IAward[] > {
    //debug("find");
    return new Promise < IAward[] >((resolve, reject) => {

      // Do the search
      modelIAward.find({})
        .lean()
        .exec()
        .then(
          (awards: IAward[]) => {
            //debug(awards);
            resolve(awards.map(f => {
              f['id'] = f['_id'].toString();
              return f;
            }));
          },
          err => {
            debug("find " + err);
            db.init();
            this.find()
              .then(result => resolve(result))
              .catch(err => reject(err))
          })
      ;
    })
  }

  /**
   * update or create an awrd (depending of id or not)
   * @param award
   * @returns {Promise<IAward>}
   */
  static updateOrCreate(award: IAward): Promise < IAward > {
    return new Promise < IAward >((resolve, reject) => {

      //debug("updateOrCreate  id:" + award["_id"]);
      if (award["_id"]) {
        award.updated = new Date();
        modelIAward.findByIdAndUpdate(award["_id"], award, {'new': true})
          .lean()
          .exec()
          .then(
            (award: IAward) => {
              award['id'] = award['_id'].toString();
              resolve(award);
            },
            err => {
              reject(err);
            });
      } else {
        modelIAward.create(award)
          .then(
            award => {
              award = award['_doc'];
              award['id'] = award['_id'].toString();
              resolve(award);
            },
            err => {
              reject(err);
            });
      }

    })
  }

  /**
   * Delete an awards
   * @param awardId
   * @returns {Promise<void>}
   */
  static remove(awardId: string): Promise < void > {
    //debug("remove");
    return new Promise < void >((resolve, reject) => {

      // Do the search
      modelIAward.remove({_id: awardId})
        .lean()
        .exec()
        .then(
          () => {
            resolve();
          },
          err => {
            debug("remove " + err);
            reject(err);
          })
      ;
    })
  }


}


