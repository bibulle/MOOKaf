import {Router, Request, Response} from "express";
import * as jwt from "express-jwt";
import * as _ from 'lodash';

import {secret} from "../config";
import User = require("../models/user");
import Award from "../models/award";

var debug = require('debug')('server:route:award');


const awardRouter: Router = Router();

// Add JWT management
var jwtCheck = jwt({
  secret: secret
});
//noinspection TypeScriptValidateTypes
awardRouter.use(jwtCheck);

// ====================================
// route to get user awards
// ====================================
awardRouter.route('/')
  .get((request: Request, response: Response) => {

    var userId = request['user']["id"];

    debug("GET /awards");
    //debug("connected user : " + JSON.stringify(request['user']));

    _respondWithAwardsList(userId, response);
  })
  // ============================================
  // update an award
  // ============================================
  .put((request: Request, response: Response) => {

    var userId = request['user']["id"];

    debug("PUT /awards");
    //debug(request.body);

    var award = new Award(request.body);
    //debug(award);

    // TODO : Add a check of user right

    // Save the award
    Award
      .updateOrCreate(award)
      .then(award => {
        //debug(award);
        _respondWithAward(userId, award, response);
      })
      .catch(err => {
        console.log(err);
        response.status(500).json({status: 500, message: "System error " + err});
      });

  })
;

/**
 * fill award with user data
 * @param award
 * @param user (from Db, not from token... should be full)
 * @returns {Promise<Award>}
 * @private
 */
function _fillAwardForUser(award: Award, user: User): Promise < Award > {
  //debug("_fillAwardForUser : " + award["id"] + ", " + user["id"]);


  return new Promise < Award >((resolve) => {

    // define the default values
    var userCount = 0;

    // get values from the user
    if (user && user.stats && user.stats[award.statKey.toString()]) {
      userCount = user.stats[award.statKey.toString()].userCount;
    }

    // assign the values into the award
    _.assign(award, {
      userCount: userCount,
      id: award['_id']
    });

    // work on the secret ones
    if (!user.isAdmin && award.secret && (award.limitCount > award.userCount)) {
      award.imgPath = "lock.svg";
      award.name = "? Secret ?";
      award.description = "Will still locked until you get it.";
    }

    resolve(award);

  })
}

function _respondWithAward(userId: string, award: Award, response: Response) {
  User.findById(userId)
    .then(user => {
      _fillAwardForUser(award, user)
        .then(completedAward => {
          response.json({data: completedAward})
        })
        .catch(err => {
          console.log(err);
          response.status(500).send("System error " + err);
        });
    })
    .catch(err => {
      //debug("find catch");
      if (err == "WRONG_USER") {
        response.status(401).send("WRONG_USER");
      } else {
        console.log(err);
        response.status(500).send("System error " + err);
      }
    });
}

function _respondWithAwardsList(userId: string, response: Response) {
  Award.find()
    .then(awards => {
      // Search the user
      User.findById(userId)
        .then(user => {
          //debug(user);
          // fill each award with users values
          var promises = _.map(awards,
            a => {
              return _fillAwardForUser(a, user)
            });
          Promise.all(promises)
            .then(completedAwards => {
              response.json({data: completedAwards})
            })
            .catch(err => {
              console.log(err);
              response.status(500).send("System error " + err);
            });
        })
        .catch(err => {
          //debug("find catch");
          if (err == "WRONG_USER") {
            response.status(401).send("WRONG_USER");
          } else {
            console.log(err);
            response.status(500).send("System error " + err);
          }
        });
    })
    .catch(err => {
      //debug("find catch");
      console.log(err);
      response.status(500).send("System error " + err);
    });
}

export {awardRouter}
