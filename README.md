- run npm install
- npm start or node index.js to start
- default port is 3000
- use Insomnia or similar to send a request to http://localhost:3000/asteroids with a body like
{
	"dateStart": "2022-03-25",
	"dateEnd": "2022-03-30",
	"within": {
		"value": 9000000,
		"units": "kilometers"
	}
}