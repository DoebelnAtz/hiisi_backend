const { validationResult } = require('express-validator');

// const countComments = async (commentThread, count = 0) => {
//     console.log(commentThread);
//
//     for (var i = 0; i < commentThread.comments.length; i++){
//         const comment = await Comment.findById(commentThread.comments[i]);
//         if (comment)
//             count = countComments(comment.commentThread, count + 1);
//     }
//     console.log(count);
//     return (count);
// };



const countAchievementPoints = (achievementList) => {
    let points = 0;
    for (var i = 0; i < achievementList.length; i++) {
        switch (achievementList[i].tier) {
            case ('medium'):
                points = points + 3;
                break;
            case ('hard'):
                points = points + 5;
                break;
            default:
                points = points + 1;
        }
    }
    return points;
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const removeDup = (arr) => {
    return (arr.filter((v, i) => arr.indexOf(v) === i));
};

exports.countAchievementPoints = countAchievementPoints;
exports.sleep = sleep;
exports.removeDup = removeDup;