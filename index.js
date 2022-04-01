const axios = require('axios');
const express = require('express');

const app = express();

const serverPort = 3000;
const apiKey = '8GnehPnpWwqfbc160QASxGU5JTF7wk7ZySZagQiU';

app.use(express.json());

const validateInput = (req, res, next) => {
    let startDateCheck = null;
    let endDateCheck = null;
    let isValid = true;
    // check to see if dateStart is present in request body, and check that it is a number
    if (req.body.hasOwnProperty('dateStart')) {
        startDateCheck = new Date(req.body.dateStart);
        if (isNaN(startDateCheck.getTime())) {
            isValid = false;
            res.status(400).send('Start date is not a date. Please change to be a date.');
            // throw new Error('Start date is not a date. Please change to be a date.');
        }
    } else {
        isValid = false;
        res.status(400).send('Start date not present. Please add start date.');
    }

    // check that dateEnd it is a number if included since endDate is 'optional' and defaults to today
    if (req.body.hasOwnProperty('dateEnd')) {
        endDateCheck = new Date(req.body.dateEnd);
        if (isNaN(endDateCheck.getTime())) {
            isValid = false;
            res.status(400).send('End date is not a date. Please change to be a date.');
        }
    }

    // check that the within value is there so we can filter
    if (req.body?.within?.value) {
        if (!isNaN(req.body.within.value)) {
            if (req.body.within.value < 0) {
                isValid = false;
                res.status(400).send('Within value is negative, must be greater than 0.');
            }
        } else {
            isValid = false;
            res.status(400).send('Within value is not a number.');
        }
    } else {
        isValid = false;
        res.status(400).send('Within value(s) missing. Please add within values.');
    }

    if (isValid) {
        next();
    }
};

app.get('/asteroids', validateInput, (req, res, next) => {
    let apiUrl = `https://api.nasa.gov/neo/rest/v1/feed?detailed=false&api_key=${apiKey}`;
    let asteroids = { asteroids: [] };
    const inputData = req.body;
    let startDateCheck = new Date(inputData.dateStart);
    let endDateCheck = inputData.dateEnd ? new Date(inputData.dateEnd) : new Date();
    let withinValue = inputData.within.value;

    // check the number of days in the date span. If more than 7 days, split up and make multiple calls.
    if (getNumberOfDays(startDateCheck, endDateCheck) > 7) {
        console.log('---Range greater than 7 days, doing multiple calls. Getting Data.---');
        let endpoints = [];

        getEndpoints(startDateCheck, endDateCheck, endpoints, apiUrl);
        axios
            .all(endpoints.map((endpoint) => axios.get(endpoint)))
            .then((response) => {
                let asteroids = [];

                response.forEach((res) => {
                    filterAndMapAsteroids(res, asteroidsToReturn, withinValue);
                });

                asteroids.asteroids = asteroids;
                res.status(200).json(asteroids);
            })
            .catch((err) => {
                next(err);
            });
    } else {
        console.log('---Getting Data---');
        apiUrl += `&start_date=${normalizeDate(startDateCheck)}&end_date=${normalizeDate(endDateCheck)}`;

        getAsteroidData(apiUrl, withinValue)
            .then((data) => {
                asteroids.asteroids = data;
                res.status(200).json(asteroids);
            })
            .catch((err) => {
                next(err);
            });
    }
});

app.use('/asteroids', (err, req, res, next) => {
    res.status(err.status || 500);
    res.send(err);
});

app.listen(serverPort, () => console.log(`Started Server at http://localhost:${serverPort}!`));

// -------------------------------------------------------------------------------
const getNumberOfDays = (startDate, endDate) => {
    let timeDifference = endDate.getTime() - startDate.getTime();
    return timeDifference / (1000 * 3600 * 24);
};

// function to get the data for a single 7 day range
const getAsteroidData = async (apiUrl, withinValue) => {
    let asteroidsToReturn = [];
    try {
        const response = await axios.get(apiUrl);
        filterAndMapAsteroids(response, asteroidsToReturn, withinValue);
        return asteroidsToReturn;
    } catch (err) {
        throw new Error(err.response.data.message);
    }
};

// given the date range, get the proper api urls
const getEndpoints = (startDate, endDate, endpoints, apiUrl) => {
    let curStart = startDate;
    let numSegments = Math.ceil(getNumberOfDays(startDate, endDate) / 7); // round up to loop proper number of times
    for (let i = 0; i < numSegments; i++) {
        let newEnd = new Date(curStart.getTime());
        newEnd.setDate(newEnd.getDate() + 7); // day 7 days from now
        // if the new end date is past the one given to use, use that end date (last time in loop)
        if (newEnd > endDate) {
            newEnd = endDate;
        }
        endpoints.push(`${apiUrl}&start_date=${normalizeDate(curStart)}&end_date=${normalizeDate(newEnd)}`);
        curStart = newEnd;
    }
};

const normalizeDate = (date) => {
    return date.toISOString().split('T')[0];
};

// loop over each date returned, and filter/map all asteroids below the within value given
const filterAndMapAsteroids = (res, asteroidsArray, withinValue) => {
    Object.keys(res.data.near_earth_objects).forEach((key, index) => {
        const curArray = res.data.near_earth_objects[key];
        const filteredArray = curArray
            .filter((item) => item.close_approach_data[0].miss_distance.kilometers < withinValue)
            .map((item) => item.name);

        asteroidsArray.push(...filteredArray);
    });
};
