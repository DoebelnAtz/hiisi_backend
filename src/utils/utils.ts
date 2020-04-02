const countAchievementPoints = (achievementList: { tier: string }[]) => {
	let points = 0;
	for (var i = 0; i < achievementList.length; i++) {
		switch (achievementList[i].tier) {
			case 'medium':
				points = points + 3;
				break;
			case 'hard':
				points = points + 5;
				break;
			default:
				points = points + 1;
		}
	}
	return points;
};

const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

exports.countAchievementPoints = countAchievementPoints;
exports.sleep = sleep;
