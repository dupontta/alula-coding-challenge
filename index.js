const axios = require('axios');
const express = require('express');

const app = express();

const serverPort = 3000;
const apiKey = '8GnehPnpWwqfbc160QASxGU5JTF7wk7ZySZagQiU';

app.use(express.json());

app.get('/asteroids', (req, res) => {
    let apiUrl = `https://api.nasa.gov/neo/rest/v1/feed?detailed=false&api_key=${apiKey}`;
    let asteroids = { asteroids: [] };
    const inputData = req.body;
    let startDateCheck = null;
    let endDateCheck = new Date();
    let withinValue = 0;

    // check to see if dateStart is present in request body, and check that it is a number
    if (inputData.hasOwnProperty('dateStart')) {
        startDateCheck = new Date(inputData.dateStart);
        if (isNaN(startDateCheck.getTime())) {
            throw new Error('Start date is not a date.');
        }
    } else {
        throw new Error('Start date not present.');
    }

    // check that dateEnd it is a number if included since endDate is 'optional' and defaults to today
    if (inputData.hasOwnProperty('dateEnd')) {
        endDateCheck = new Date(inputData.dateEnd);
        if (isNaN(endDateCheck.getTime())) {
            throw new Error('End date is not a date.');
        }
    }

    // check that the within value is there so we can filter
    if (inputData?.within?.value) {
        if (inputData.within.value > 0) {
            withinValue = inputData.within.value;
        } else {
            throw new Error('Within value is negative, must be greater than 0.');
        }
    } else {
        throw new Error('Within value(s) missing.');
    }

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
                res.send(asteroids);
            })
            .catch((err) => {
                res.status(500).send(err.message);
                throw new Error(err.response.data.message);
            });
    } else {
        console.log('---Getting Data---');
        apiUrl += `&start_date=${normalizeDate(startDateCheck)}&end_date=${normalizeDate(endDateCheck)}`;

        getAsteroidData(apiUrl, withinValue)
            .then((data) => {
                asteroids.asteroids = data;
                res.send(asteroids);
            })
            .catch((err) => {
                res.status(500).send(err.message);
                throw new Error(err.response.data.message);
            });
    }
});

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

app.listen(serverPort, () => console.log(`Started Server at http://localhost:${serverPort}!`));
