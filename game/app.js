const MAP_W = 32768;
const MAP_H = 32768;
const ZERO_X = 16384;
const ZERO_Y = 16384;
const TILE_SIZE = 256;
const TILE_Z = 3;
const TILE_RANGES = {
  0: [[0, 0], [2, 2]],
  1: [[0, 1], [4, 5]],
  2: [[0, 2], [9, 11]],
  3: [[0, 4], [19, 23]],
  4: [[0, 8], [38, 47]],
  5: [[0, 17], [77, 95]],
  6: [[0, 34], [155, 190]],
};
const TILE_RANGE = TILE_RANGES[TILE_Z];
const TILE_ROOT = "../gtadb.org/maps/tiles/6/yanis,12";
const DETAIL_TILE_Z = 5;
const DETAIL_TILE_RADIUS = 7;
const DETAIL_TILE_KEEP_RADIUS = 10;
const DETAIL_TILE_LEVELS = [5];
const VC_DATA = "../data/gtamapdata.json";
const VC_RESULT = "../optimizer/result.json";
const VC_MAP3D_COLORS = "../ui/data/map3d-colors.json";
const VC_FOUR_SEASONS_WIREFRAME = "../ui/data/map3d-four-seasons.json";
const VC_SUNSHINE_SKYWAY_WIREFRAME = "../ui/data/map3d-sunshine-skyway.json";
const VC_HANKS_WAFFLES_WIREFRAME = "../ui/data/map3d-hanks-waffles.json";
const LANDMARK_MODELS = "landmarks/landmarks.json";
const FOUR_SEASONS_NAME = "Four Seasons Hotel Miami (NW)";
const METAR_TEXT = "KLNI 221753Z 18012KT 9999 FEW420 28/22 A2992 RMK";
const GRAVITY = 9.8;
const THROTTLE_FORCE = 46;
const DIVE_ACCEL = 7;
const DRAG = 0.9862;
const MIN_BRAKE_SPEED = 10;
const BULLET_SPEED = 520;
const PRISON_DEFENSE_RADIUS = 500;
const PRISON_SHOT_SPEED = 185;
const FIGHTER_ROUTE_SPEED = 0.015;
const FIGHTER_ATTACK_SECONDS = 15;
const FIGHTER_SHOT_SPEED = 260;
const LEAF_LINKS_CENTER = [730, 2390, 0];
const LEAF_LINKS_RADIUS = 150;
const SKYVIEW_WHEEL_POS = [-57, 257, 0];
const SKYVIEW_WHEEL_TOP = 75;
const SKYVIEW_WHEEL_RADIUS = 35;
const SKYVIEW_WHEEL_YAW = 240 * Math.PI / 180;
const SCHLOTT_PANEL_X = -16000;
const SCHLOTT_PANEL_SOUTH = -3000;
const SCHLOTT_PANEL_NORTH = -1000;
const TREVOR_FLICKER_ZONE = { west: -7000, east: -6500, south: -6000, north: -5500 };
const VISUAL_MODE_CLASSES = ["michael", "amanda", "jimmy", "tracey", "trevor"];
const CAMERA_CHASE = 46;
const CAMERA_UP = 15;
const CAMERA_THUMBNAIL_DISTANCE = 100;
const TURBULENCE_NORTH_START = 6100;
const TURBULENCE_NORTH_FULL = 7500;
const DEAD_ZONE_START = 11000;
const DEAD_ZONE_FULL = 12000;
const ICON_TEXTURE = "../ui/gtamaplib-vc.png";
const WATER_COLOR = [44 / 255, 103 / 255, 164 / 255, 1];
const NIGHT_MAP_BRIGHTNESS = 0.15;
const MAP3D_POSE_STORAGE_KEY = "gtamaplib-vc.map3dPose";
// Previous radio preset: highpass 1100/0.7, lowpass 3200/1.4, distortion 95,
// compressor -34/4/18/0.005/0.16, tremolo 7.2 Hz at 0.16 depth.
const RADIO_FILTER = {
  highpassFrequency: 1700,
  highpassQ: 0.9,
  lowpassFrequency: 2850,
  lowpassQ: 2.1,
  distortion: 135,
  compressorThreshold: -38,
  compressorKnee: 3,
  compressorRatio: 20,
  compressorAttack: 0.004,
  compressorRelease: 0.13,
  tremoloFrequency: 8.5,
  tremoloDepth: 0.12,
  tremoloBase: 0.82,
};
const RADIO_LINES = [
  "Vice Tower: experimental flight plan denied, again.",
  "Leonida Approach: whoever is buzzing the postcards, please use a door.",
  "News 9: we are seeing one extremely confident floatplane.",
  "Coast Guard: small boats report vibes falling from the sky.",
  "Vice Tower: runway is for landing, not for collecting screenshots.",
  "Tourist blimp: we are not part of the mission. Probably.",
  "Mapping error: please return immediately.",
  "Vice Tower: your aircraft is inside a screenshot. Clarify intentions.",
  "Leonida Center: we have you on radar and several Discord threads.",
  "News 9: experts describe the situation as very manually triangulated.",
  "Airport Ops: runway incursion reported by a seaplane with main character energy.",
  "Coast Guard: advise all vessels to ignore the flying spreadsheet.",
  "Vice Tower: your altitude is legal in three coordinate systems and alarming in two.",
  "Leonida Approach: confirm you are not attempting to optimize the airport.",
  "Tourist blimp: if you can read this, please stop reading this.",
  "News 9: the pilot appears to be collecting evidence against geometry.",
  "Vice Tower: screenshot fly-through is not an approved landing procedure.",
  "Mapping error: landmark moved, vibes unchanged.",
  "Leonida Center: we lost your transponder but gained several pixels.",
  "Coast Guard: small craft advisory now includes low-flying opinions.",
  "Vice Tower: be advised, Four Seasons is still on fire.",
  "News 9: smoke visible downtown; room service unavailable.",
  "Airport Ops: large jet is circling normally. Please do not make it weirder.",
  "Leonida Approach: your yaw solution is suspiciously confident.",
  "Vice Tower: please maintain separation from blimp, bridge, and narrative.",
  "Mapping error: please rotate 180 degrees and reconsider.",
  "Coast Guard: boats are staying in the water. We appreciate the effort.",
  "News 9: sources confirm the plane is controlled by vibes and shoulder buttons.",
  "Tourist blimp: we have snacks and no legal department.",
  "Vice Tower: do not shoot missiles at calibration artifacts.",
  "Leonida Center: camera cone collision detected, emotionally.",
  "Airport Ops: whoever parked a photograph at 100 meters, call maintenance.",
  "Mapping error: optimizer result appears airborne.",
  "News 9: local residents demand fewer triangles, more answers.",
  "Vice Tower: your flight plan says 'very vibe coded'. Please elaborate.",
  "Coast Guard: wake turbulence replaced by wake sarcasm.",
  "Leonida Approach: confirm visual on enormous invisible math.",
  "Tourist blimp: this banner intentionally left implausible.",
  "Vice Tower: please avoid the wireframe hotel. It is having a day.",
  "Mapping error: priors missing. Confidence excessive.",
  "News 9: helicopter crew reports a tiny yellow plane doing bits.",
  "Airport Ops: runway closed due to ambient nonsense.",
  "Leonida Center: your controller mapping has been described as 'finally fine'.",
  "Vice Tower: if you see birds, they are not official navigation aids.",
  "Coast Guard: one boat reports being called 'little white boat'.",
  "Mapping error: please return immediately.",
  "News 9: we go now to our sky correspondent, who is also confused.",
  "MAPPING IN PROGRESS - PLEASE VACATE AIRSPACE",
  "[WARNING] Camera 0041 has negative focal length. Ignoring.",
  "we're working on it.",
  "Authorities confirm the map is, quote, \"mostly right\"",
  "we're live above what appears to be... a triangulation error.",
  "prior: vibes",
  "landmark confidence: 12%. proceeding anyway.",
  "do NOT fly through that. ...okay you flew through that.",
  "the ocean is load-bearing. please do not touch it.",
  "four seasons still on fire. this is noted. this is filed. this is ignored.",
  "reprojection error, please stand by",
  "[BUNDLE ADJUSTMENT COMPLETE] errors redistributed evenly. you're welcome.",
  "please be advised: the Keys are approximately 40 meters further south than expected. have a nice day.",
  "unknown aircraft, please identify yourself. unknown aircraft, we can see you. unknown aircraft, okay fine.",
  "the blimp is not supposed to be doing that.",
  "weather: suspicious",
  "uh, tower, we have a... the thing is...",
  "this airspace is rated E for Errors",
  "you are now leaving the reconstruction zone. your coordinates are now someone else's problem.",
  "that is not a designated flight path!!",
  "small boat traffic is expressing emotions again. we are monitoring.",
  "lightning strike detected. adding to the dataset.",
  "sir this is a Wendy's",
  "altitude looks fine. everything else: jury's out.",
  "please stop flying in circles.",
  "mayday is a strong word.",
  "you appear to be flying through a screenshot. this is technically legal.",
  "news chopper, can we go off the record for a moment?",
  "do not approach the calibration checkerboard. do not make eye contact with it.",
  "SPARSE747, you don't have landing gear.",
  "CAUTION: LOW CONFIDENCE SWAMP REGION",
  "WARNING: BRIDGE CURRENTLY APPROXIMATE",
  "WARNING: PHOTOGRAMMETRY EVENT IN PROGRESS",
  "Air Traffic Control would like a word",
  "NO FLY ZONE except for you apparently",
  "PLEASE STOP FLYING THROUGH ACTIVE BUNDLE ADJUSTMENT OR OPTIMIZATION",
  "Seaplane entering low-polygon weather cell",
  "Mission updated. Just kind of keep flying",
  "This is the year we lost contact.",
  "Airspace temporarily closed. Reopening soon. Just fixing some leaks...",
  "SPOILER: THE DOG DIES",
  "Prevented from using lower priority seats",
  "No, you can't see Ambrosia from here.",
  "If you think this is Watson Bay, you are fundamentally mistaken.",
  "Do not complain about lack of airfields. We have nothing to do with this.",
  "Do you need vectors? ... Hmm... looks like you don't.",
  "That VOR beacon is really just decorative, ignore at all costs.",
  "No, these boats are not clipping. They are ambhibious vehicles",
  "Sparse747 heavy, descend to one thousand, report pelican in sight.",
  "all aircraft be advised, the ILS is working but it is not happy about it.",
  "unknown traffic, you are not on our radar. you are not on any radar. please advise.",
  "Citation on left base, say intentions. Citation, say intentions. Citation, you just did a loop, we saw it.",
  "winds calm, visibility unlimited, one boat on fire, otherwise clear.",
  "traffic alert, twelve o'clock, two miles, altitude unknown, nature unknown, it's the blimp again.",
  "say souls on board. ...say souls on board. that's a lot of souls for a seaplane.",
  "Leonida ground, be advised, runway 27 is temporarily a crime scene. expect delays.",
  "November four-niner tango, you are cleared direct, but we want you to think about what you did.",
  "all stations, all stations, be advised there is a man on the taxiway. he seems confident. do not encourage him.",
  "squawk seven-seven-zero-zero. ...that's not why we use that code but sure.",
  "say altitude. say altitude again. that's not an altitude. that's a feeling.",
  "traffic, ten o'clock, same altitude, they say they don't see you either, nobody knows what's happening.",
  "cleared to land, runway two-four, caution, surface condition reported as, quote, \"damp and philosophical.\"",
  "Sparse747 confirm you are not on fire. Sparse747, that was not rhetorical.",
  "be advised, the VOR is operational but has strong opinions today.",
  "contact approach on one-two-zero-decimal-nine. they know. they're waiting. they're calm about it. too calm.",
  "Leonida tower to all aircraft: the Keys are a no-fly zone until further - actually it's fine. disregard. do not disregard.",
  "maintain visual separation from the news helicopter. the news helicopter is not maintaining visual separation from you.",
  "radar contact lost. radar contact reacquired. radar has questions.",
  "you are number one for the approach. number two is a pelican. number two does not understand ATC instructions.",
  "unable to issue traffic advisories at this time. we are aware of the irony.",
  "Leonida approach, request lower. request denied. request noted. request denied again.",
  "aircraft on the beach heading, say callsign. ...say callsign. we're going to call you Boat Guy.",
  "altimeter two-niner-niner-two. that's probably fine.",
  "...and the mayor confirmed he has never been to Florida, has always been to Florida, and will not be taking further questions.",
  "roger, radar contact, two miles east of where you think you are.",
  "climb and maintain four thousand. or three thousand. we're having a conversation about it internally.",
  "traffic in your vicinity is squawking twelve hundred and appears to be having a great time.",
  "Leonida tower, say again, you're breaking up. Leonida tower, you were never breaking up, we just needed a moment.",
  "correction, correction, disregard last, disregard disregard, stand by.",
  "number two for the approach behind a Cessna, a flamingo, and something we're still classifying.",
  "cleared ILS runway two-four. the glideslope is suggestive rather than authoritative today.",
  "say aircraft type. ...we don't have that in the database. we're adding it now. under \"misc.\"",
  "expect vectors for sequencing. do not expect an explanation.",
  "all aircraft, be advised, sunset is occurring. this is not a drill.",
  "the yellow seaplane, say altitude again. the yellow seaplane, we are going to need you to pick a number.",
  "you are in controlled airspace. you appear unbothered by this information.",
  "negative, that is not an approved approach. that was incredible, but it is not approved.",
  "say fuel state. ...say fuel state in units we recognize.",
  "you are now outside radar coverage. you are on your own. godspeed. we mean that genuinely.",
  "Boat Guy, climb to VFR cruising altitude. Boat Guy you are skimming the water. Boat Guy.",
  "be advised you just flew through a camera position. this has been logged.",
  "lost sight of your aircraft. regained sight of your aircraft. we need a minute.",
  "November niner-niner whiskey, say intentions. ...that's not an intention, that's a direction, and it's straight down.",
  "squawk VFR and remain clear of - you know what, just try not to hit anything sentimental.",
  "all aircraft, SIGMET issued for the Keys area. phenomenon described as \"a lot.\"",
  "be advised, a runway incursion has been reported on the taxiway. the incursion has a jetski.",
  "Leonida ground, aircraft on the ramp is refusing to file a flight plan. says he knows where he's going. we do not share this confidence.",
  "declaring minimum fuel. tower acknowledges. tower sympathizes. tower asks what your plan was originally.",
  "aircraft on right downwind, are you aware you're upside down. aircraft on right downwind.",
  "go around, go around, I say again go around. thank you. now do it right-side up.",
  "Leonida approach, we have a pilot report of turbulence at three thousand over the bridge. pilot describes it as \"spiritually significant.\"",
  "be advised the four seasons hotel is still on fire. this has been notamed. pilots are advised to treat it as a visual landmark.",
  "wake turbulence caution, heavy aircraft departed two minutes ago. also it was on fire when it departed. just a heads up.",
  "bird strike reported on short final. bird is fine. aircraft is thinking about its choices.",
  "Leonida tower is temporarily operating with reduced staff. by which we mean Dave left.",
  "ATIS information Kilo is current. ATIS information Kilo is a lie, but a comforting one.",
  "radar maintenance complete. radar is back online and has forgotten everything it knew about you.",
  "all frequencies will be monitored. all frequencies will also be judged.",
  "Leonida approach control closed at two-three-zero-zero local. after that you're on your own and so are we.",
  "stand by, we are resolving a disagreement between two radar returns that are both claiming to be you.",
  "frequency change approved. new frequency is one-two-three-decimal-four-five. they're friendlier there. different vibe.",
  "tower is experiencing a brief philosophical crisis. expect minor delays.",
  "this is a reminder that VFR flight following is a service and not a guarantee and definitely not a friendship. although. you know.",
  "Leonida departure, be advised — actually, just. be advised. generally. as a practice.",
  "#39 is lowkey my favorite",
  "Yorktown at 3 o'clock. Sober up, ladies.",
  "You are NOT on approach. This airfield is PURE SPECULATION.",
  "What do you mean \"where is the panhandle?\"",
  "Roger. I mean, no... not you!",
  "Delta Tango Foxtrott. I repeat: Foxtrott!",
  "the map is not the territory",
  "deliver the calibration target to the marina. do not roll the aircraft. we will know.",
  "Screenshot Police. Hands up where I can see them!",
  "Stay clear of Ambrosia. No, that airfield does not exist! We call it the I-505. Yes, that's an Insider joke. But still...",
  "Notice to airmen: you are not REALLY airmen, okay?",
  "My strongest hunch is still orphaned RAF loops.",
  "DMCA_TAKE_DOWN_PREVENTED_BY_LOCAL_HOST_RULE",
];
const NON_INTERACTIVE_EVENTS = [
  "2 NIECH - Multi Car Hangout at PGH Soccer Field",
  "3 NIESCF - SB Beach 01",
  "6 NIECH - Boat Trailer Car Hangout Mar...",
  "7 NIESCF - SB Beach 02",
  "10 NIECH - Boat Trailer Car Hangout Dir...",
  "11 NIESCF - SB Beach 03",
  "13 NIECH - Single Truck Hangout Dirty O...",
  "14 NIESCF - PG Canal Fishing Coast 01",
  "16 NIECH - Single Car Hangout Strip Club",
  "17 NIESCF - PG Canal Fishing 01",
  "21 NIECCR - Industrial Area",
  "22 NIESCF - PG Neighbourhood Coast 01",
  "25 NIECCR - Trailer Park",
  "26 NIESCF - SB Beach 04",
  "29 NIECCR - Dairy Farm",
  "30 NIESCF - SB Beach 05",
  "33 NIECCR - Residential 1",
  "34 NIESFP - South Beach Drive",
  "38 NIECCR - Residential 2",
  "39 NIESFP - South Beach Park",
  "43 NIECCR - Motel 01",
  "44 NIESFP - PGH Liquor Store",
  "47 NIECCR - PG Basketball Court 01",
  "48 NIESFP - South Beach Boardwalk 1",
  "52 NIECCR - PG Trailer Park 01",
  "53 NIESFP - PGH Trailer Park",
  "57 NIECCR - PG Trailer Park 02",
  "58 NIESFP - PGH CarwashHangouts1",
  "61 NIECCR - PG Trailer Park 03",
  "62 NIEST - Distracted - PGH Police Stn",
  "65 NIECCB - Akery Inn",
  "66 NIEST - PGH Police Stn",
  "69 NIECCB - Pawn Shop",
  "70 NIEST - PGH East",
  "73 NIECCB - Dairy Farm",
  "78 NIECCB - Ambrosia Farm",
  "79 NIEST - Distracted - RoseInterstateS...",
  "82 NIECCB - Trailer Park 01",
  "83 NIEST - PgWarehouse1",
  "87 NIECCB - Trailer Park 02",
  "88 NIEST - VC Suburbs North 22",
  "93 NIECCB - PG Basketball Court 01",
  "94 NIETPFP - Gen Stand FM",
  "99 NIECCB - Trailer Park 03",
  "100 NIETPFP - Gen Stand FM",
  "105 NIECCB - SB Ocean Drive 01",
  "106 NIETPFP - Hold Monument Stand FM",
  "110 NIECCP - Pawn Shop Stand Nothing",
  "111 NIETPFP - Hold Monument Stand FM",
  "115 NIETPFP - Stand MF",
  "118 NIECCP - Pawn Shop Loco Nothing",
  "119 NIETPFP - Stand MF",
  "123 NIECCP - Food Store Find Nothing",
  "124 NIETPFP - Gen Stand FM",
  "128 NIECCP - Food Store Find Something",
  "129 NIETPFP — Stand MF",
  "132 NIECON - ATVs & Dirtbikes",
  "133 NIETPFP - Gen Stand FM",
  "137 NIECON - ATVs & Dirtbikes",
  "138 NIETPFP - Gen Stand FM",
  "142 NIECON - ATVs & Dirtbikes",
  "143 NIETT - LO Prison",
  "146 NIECON - Trucks",
  "147 NIETT - LO Racetrack",
  "151 NIEDA Possum - Port Gellhorn 01",
  "152 NIETT - PGH Motel",
  "154 NIEDA Raccoon - Port Gellhorn 01",
  "155 NIEVB - Carwash Car Left",
  "158 NIEDA Skunk - Port Gellhorn 01",
  "159 NIEVB - Carwash Car Right",
  "163 NIEDA Skunk - Port Gellhorn Fence 01",
  "164 NIEVB - Carwash Truck Left",
  "169 NIEDA Raccoon - Port Gellhorn Fence",
  "170 NIEVB - Carwash Truck Right",
  "174 NIEDA Racoon - Port Gellhorn Bowling",
  "175 NIEVD - PGH Carwash",
  "180 NIEDA Racoon - Port Gellhorn Trailer Park",
  "181 NIEVD - PGH Soccer Field",
  "185 NIEDA Skunk - Port Gellhorn Trailer Park",
  "186 NIEVOT StripMall WithTrailer",
  "191 NIEVOT StripMall NoTrailer",
  "196 NIEDA Skunk - Port Gellhorn Trailer",
  "197 NIEVOT PghConstruction ConstructionSite",
  "201 NIEDAS - Redhill - Construction Site",
  "202 NIEVOT PghConstruction1 ConstructionSite",
  "207 NIEDAS - Redhill - Roadside Rocks",
  "208 NIEVOT PghConstruction1 ContractorTrailer",
  "211 NIEDAS - Redhill - Forest 1",
  "212 NIEVOT PghConstruction2 ConstructionSite",
  "216 NIEDTR - RedHill Forest 01",
  "217 NIEVOT PghStripClub2 Construction",
  "220 NIEDT Delivery PgWarehouse",
  "221 NIEVOT PghStripClub1 LowValueTrailer",
  "224 NIEDT Pickup PgWarehouse",
  "225 NIEVOT PghQuickShop ContractorTrailer",
  "229 NIEDT Pickup PgWarehouse2",
  "230 NIEVOT PghFence NoTrailer",
  "236 NIEVOT PghTrailerConstruction NoTrailer",
  "241 NIEVOT PghTrailerConstruction WithTrailer",
  "253 NIEVOT SbPath2 MaintenanceTrailer",
  "258 NIEVOT PghWarehouse1 Construction",
  "263 NIEDBR - South Beach 01",
  "264 NIEVPT - Strip Mall HopIn",
  "269 NIEDBR - South Beach 02",
  "270 NIEVPT - Strip Mall NoHop",
  "274 NIEDBR - South Beach 03",
  "275 NIEVPT - Dirty Oar NoHop",
  "280 NIEDBR - South Beach 04",
  "281 NIEWWD - South Beach 01",
  "313 NIEDCT - Trailer Park",
  "325 NIEDCT - Dairy Farm 02",
  "326 NIEBYTR - Abandoned Trains",
  "338 NIEDCT - Abandoned Carnival",
  "339 NIEBYTR - Broke Bus",
  "349 NIEDCT - PG Neighbourhood 01",
  "350 NIEBYTR - PGH Train Station",
  "358 NIEDCT - PG Neighbourhood 02",
  "359 NIEBYTR - PGH Train Station 2",
  "371 NIEDCT - PG Neighbourhood 03",
  "372 NIEBYTR - PGH Train Tracks",
  "381 NIEDCT - PG Trailer Park 01",
  "382 NIECB - ButtLight",
  "392 NIEDCT - PG Trailer Park 02",
  "393 NIECB ButtPocket",
  "404 NIEDCT - PG Trailer Park 03",
  "405 NIEDD",
  "415 NIEDDI - PG Residential 01",
  "416 NIEHDA - Exit Big Gulp",
  "426 NIEDDI - PG Trailer Park 01",
  "427 NIEHDA - Exit Head Nod",
  "437 NIEDDI - PG Trailer Park 02",
  "438 NIEHDA - Exit Laugh",
  "447 NIEDLF - South Beach",
  "460 NIEDLF - Dairy Farm",
  "461 NIEHDA - Head Nod",
  "471 NIEDLF - PG Neighbourhood 01",
  "472 NIEHDA - Low Key",
  "479 NIEDLF - PG Neighbourhood 02",
  "490 NIEDLF - PG Neighbourhood 03",
  "491 NIEHDA - Peds In Place",
  "501 NIEDLF - PG Neighbourhood 04",
  "502 NIEHDC - Big Gulp",
  "510 NIEDLF - SB Ocean Drive 01",
  "511 NIEHDC - Exit Big Gulp",
  "520 NIEDLF - SB Boardwalk 01",
  "521 NIEHDC - Exit Head Nod",
  "530 NIEDOPUP - South Beach 01",
  "541 NIEDOPUP - South Beach 02",
  "542 NIEHDC - Exit Low Key",
  "550 NIEDOPUP - South Beach 03",
  "551 NIEHDC - Head Nod",
  "560 NIEDOPUP - South Beach 04",
  "561 NIELS - HandLightFM",
  "572 NIEDOPUP - South Beach 05",
  "573 NIEPSP - Sick After",
  "582 NIEDOPUP - South Beach 06",
  "583 NIEPSB - Wipe Mouth",
  "592 NIEDOPUP - South Beach 07",
  "593 NIEPSB - Yeah Bro",
  "601 NIEDP - Trailer Park",
  "602 NIEPS - ElaborateStandMaleCool",
  "610 NIEDP - Dairy Farm",
  "611 NIEPS - ElaborateStandFemaleChill",
  "618 NIEAB - South Beach",
  "620 NIEDP - Ambrosia Farm",
  "621 NIEPS - RegularGroundSitFemale",
  "627 NIEAB - East Key",
  "629 NIEDP - Poor Neighbourhood",
  "630 NIEPS - RegularChairSitFemale",
  "635 NIEAOS - South Beach 01",
  "637 NIEDP - Residential",
  "638 NIEPS - ElaborateBeachChairFemaleChill",
  "645 NIEAOS - South Beach 02",
  "647 NIEDFP - South Beach 01",
  "648 NIEPS - ElaborateGroundSitFemaleHead",
  "655 NIEAOS - South Beach 03",
  "657 NIEDPF - South Beach 02",
  "658 NIEPS - ElaborateLedgeMaleCool",
  "665 NIEAOS - South Beach 04",
  "667 NIEDPF - South Beach 03",
  "668 NIEPS - ElaborateLedgeFemaleTrendy",
  "675 NIEARB - PGH BEACH Default",
  "677 NIEDPF - South Beach 04",
  "678 NIEPS - ElaborateSitChairMale",
  "685 NIEBFS - Pigeon - South Beach 01",
  "687 NIEDSB - Trailer Park 01",
  "688 NIEPS - RegularBeachChairMaleLeft",
  "695 NIEBFS - Seagull - South Beach 01",
  "697 NIEDPUWS - SB Ocean Drive 01",
  "698 NIEPS - RegularBeachChairMaleRight",
  "704 NIEBFS - Seagull - Mini Mall 01",
  "706 NIEDPUWS - SB Ocean Drive 03",
  "707 NIEPS - RegularBeachChairMaleTop",
  "714 NIEBFS - Pigeon - Mini Mall 01",
  "716 NIEDPUWS - SB Ocean Drive 03",
  "717 NIEPS - ElaborsteBeachChairMaleSuave",
  "724 NIEBFS - Seagull - Food Store 01",
  "726 NIEED - Motel",
  "727 NIEPS - ElaborateBeachChairMaleChill",
  "735 NIEBFS - Pigeon - PG Trailer Park 01",
  "737 NIEECF - River 1",
  "738 NIEPS - RegularGroundButtSelfieMale",
  "745 NIEBFS - Seagull - PG Trailer Park 01",
  "747 NIEECF - River 2",
  "748 NIEPS - RegularGroundButtSelfieFemale",
  "755 NIEBFS - Seagull - PG Motel 01",
  "757 NIEECF - River 3",
  "758 NIESAS - PickButtSubtle",
  "765 NIEBFS - Pigeon - PG Gas Station 01",
  "767 NIEECF - River 4",
  "768 NIESAS - PickBoogers",
  "775 NIEBFS - Seagull - PG La Cascara Motel",
  "777 NIEECF - PG Trailer Park Canal 01",
  "778 NIESAS - PickButtLowKey",
  "787 NIEBFS - Seagull - South Beach 02",
  "789 NIECE - PGH Clinic",
  "790 NIESAS - PickEars",
  "797 NIEBFS - Seagull - South Beach 03",
  "799 NIECE - PGH Bingo Hall",
  "800 NIESAS - WipePitsArmsSide",
  "809 NIEBFS - Seagull - South Beach 04",
  "811 NIECE - PGH Trailer Park",
  "812 NIESAS - WipePitsHandsHips",
  "818 NIEBFS - Seagull - South Beach 05",
  "820 NIECE - PGH Wastewater Plant",
  "821 NIESF - Show Off Fail",
  "828 NIEBFS - Seagull - South Beach 06",
  "830 NIECE - PGH Police Station",
  "831 NIESLB - Truck",
  "837 NIEBFS - Seagull - South Beach 07",
  "839 NIECE - PGH Substation",
  "840 NIESLB - Car",
  "849 NIEBFS - Seagull - South Beach 03",
  "851 NIECE - PGH Abandoned Building",
  "856 NIEDGE - Trailer Park",
  "866 NIEDGE Trailer Park 2",
  "871 NIEBFS - Seagull - South Beach 10",
  "873 NIEF SouthBeach01",
  "875 NIECGEO - CatsGroomingEachOther",
  "881 NIE Give Coffee Male Seated",
  "884 NIEBLS - Pigeon - South Beach 01",
  "886 NIEFCR - Redhill - River Bend Forest",
  "894 NIEBLS - Seagull - South Beach 01",
  "896 NIEFCR - Redhill - Roadside Rocks",
  "905 NIEBOA - RedHill Forest 01",
  "906 NIEFCR - Dairy Farm",
  "917 NIEBS - Biking",
  "918 NIEFCR - Redhill - River Bend Forest",
  "928 NIEBS - Biking",
  "929 NIEFCR - Redhill - River Bend Forest",
  "936 NIEBS - Walking",
  "937 NIEGT - South Beach",
  "945 NIEBS - Walking",
  "946 NIEGD - South Beach",
  "950 NIE Influencer Pose for Photo",
  "955 NIEBS - Stand Female Asks Male",
  "957 NIEBS - Walking",
  "958 NIEGD - South Beach Beach",
  "963 NIE Alligator Ambush Boar Leg",
  "969 NIEBS - Biking",
  "970 NIEIPFP - Chill Kneel FM",
  "972 NIE Alligator Ambush Boar Neck",
  "981 NIEBT - DepressedForwardPGHFruitStand",
  "982 NIEIPFP - Chill Kneel MF",
  "993 NIEBT - DrunkBackwardPGHFruitStand",
  "994 NIEIPFP - Chill Stand MF",
  "1003 NIECE - Fist Bump FM",
  "1004 NIEBT - DrunkForwardFarPGHFruitStand",
  "1005 NIEIPFP - Flex Kneel MF",
  "1013 NIECE - Fist Bump FM",
  "1016 NIEBT - DrunkSmashPGHFruitStand",
  "1017 NIEIPFP - Flex Stand MF",
  "1019 NIECE - Fist Bump FM",
  "1026 NIECE - Fist Bump FM",
  "1028 NIEBT - ForwardMedPGHFruitStand",
  "1029 NIEIPFP - Trendy Kneel FM",
  "1035 NIECE - Fist Bump FM",
  "1040 NIECE - Fist Bump FM",
  "1042 NIEIPFP - Trendy Stand FM",
  "1048 NIECE - Fist Bump FM",
  "1051 NIEBD - Ambrosia Farms",
  "1052 NIEIPFP - Trendy Stand FM",
  "1055 NIECE - Fist Bump FM",
  "1059 NIECE - Fist Bump FM",
  "1060 NIEBD - Shooting Range",
  "1061 NIEIPFP - Trendy Stand FM",
  "1064 NIECE - Fist Bump MF",
  "1067 NIECE - Fist Bump MF",
  "1068 NIEBF - Redhill - Construction Site",
  "1069 NIEIPFP - Chill Kneel FM",
  "1075 NIECE - Fist Bump MF",
  "1077 NIEBF - Redhill - Roadside Rocks",
  "1078 NIEIPFP - Chill Stand MF",
  "1082 NIECE - Fist Bump MF",
  "1086 NIECE - Fist Bump MF",
  "1087 NIEBF - RedHill Forest 01",
  "1088 NIEIPFP — Chill Stand MF",
  "1091 NIECE - Fist Bump MF",
  "1094 NIECE - Fist Bump MF",
  "1095 NIEBF - RedHill Forest 02",
  "1096 NIEIPFP - Chill Stand MF",
  "1101 NIECE - Handshake MF",
  "1102 NIECH - Cars Church",
  "1103 NIETPFP — Chill Stand MF",
  "1108 NIEDPS - Port Gellhorn 1",
  "1110 NIECH - Trucks Church",
  "1111 NIEJD - South Beach Pier",
  "1113 NIEDPS - Dairy Farm",
  "1116 NIEDPS - PGH Neighbourhood 1",
  "1117 NIECH - Truck Dairy Farm",
  "1118 NIEJD - South Beach Hotel",
  "1122 NIEDPS - SBBoardwalkBench1",
  "1123 NIECH - Car Carwash",
  "1124 NIEJD - South Beach Park",
  "1126 NIEDPS - SBBoardwalkBench3",
  "1129 NIEDPS - SBBoardwalkBench2",
  "1130 NIECH - Car Music Carwash",
  "1131 NIELS - PGH",
  "1134 NIE Lean In Window Drug Deal Male N...",
  "1137 NIE Lean In Window Drug Deal Female ...",
  "1138 NIECH - Truck Backyard",
  "1139 NIELS - Dairy Farm",
  "1145 NIELS - PGH Beach Bonfire",
  "1148 NIE_LIWDD - SN_11_Female",
  "1150 NIE_LIWDD - SN_17 Male",
  "1152 NIECH - Truck Music Carwash",
  "1153 NIELS - PGH Beach Bonfire Peninsula",
  "1155 NIE_LIWDD - SN_17 Female",
  "1157 NIE_LIWDD - SN_17_2 Male",
  "1158 NIECH - Car Marina",
  "1159 NIEMC - One Vehicle - PGH Basketball Court",
  "1163 NIE_LIWDD - SN_17_2 Female",
  "1164 NIECH - Cars Strip Mall",
  "1165 NIEMC - PGH Basketball Court",
  "1168 NIEMB - Donut Burnout",
  "1170 NIEMB - Donut Burnout",
  "1172 NIECH - Trucks Strip Mall",
  "1173 NIEMC - PGH Pawn Shop",
  "1177 NIE Raccoon Climb Out Of Garbage",
  "1178 NIECH - Car Open Door W Music at Ha...",
  "1179 NIEMC - PGH Trailer Park",
  "1182 NIE Raccoon Rummage Trash",
  "1184 NIECH - Car Hangout at Copperhead",
  "1185 NIEMC - LO Dairy Farm",
  "1187 NIE Raccoon Steal Food Bag",
  "1190 NIESPC - Stand Can",
  "1191 NIECH - Car Hangout at PGH Bingo",
  "1192 NIEMC - One Vehicle - PGH Power Station",
  "1196 NIESPC - Stand Cig Pack",
  "1199 NIESREP - Car",
  "1200 NIECH - Truck Hangout at PGH Food Stand",
  "1201 NIEMC - One Vehicle - PGH Bowling Alley",
  "1204 NIESREP - Car",
  "1206 NIECH - Multi Truck Hangout at PGH F...",
  "1207 NIEMC - One Vehicle - South Beach Park",
  "1209 NIESREP - Car",
  "1210 NIESREP - Car",
  "1211 NIEMC - One Vehicle - South Beach",
  "1213 NIESREP - Motorcycle",
  "1214 NIESREP - Truck",
  "1215 NIEMC - One Vehicle - South Beachside",
  "1217 NIESREP - Rev Engine Burnout",
  "1218 NIEOD - PGHTown",
  "1221 NIEVLIW - Car Driver Window",
  "1222 NIEVLIW - Car Passenger Window",
  "1224 NIEOD - PGHWilderness",
  "1226 NIEVLIW - Car Passenger Window",
  "1228 NIEVLIW - Truck Driver Window",
  "1229 NIEOD - PGHBonFire",
  "1232 NIEVLIW - Truck Passenger Window",
  "1233 NIEOD - PGHStripMall",
  "1235 NIE Vehicle Offroad",
  "1237 NIEVPT La Perle",
  "1238 NIEOD - PGHResidential",
  "1241 NIE - YPPT Standing Garage",
  "1243 NIE - YPPT Squatting Garage",
  "1244 NIEOD - PGHResidential2ATV",
  "1248 NIEOD - PGHResidential3",
  "1251 NIEOD - VCSuburbsNorth1",
  "1255 NIEOD - VCSuburbsLemonThrift",
  "1260 NIEPV - South BeachVPhHPF",
  "1264 NIEPV - South Beach HPhVPF",
  "1267 NIEPV - South BeachVPhHPS",
  "1271 NIEPV - South Beach HPhHPS",
  "1275 NIEPV - South Beach BeachHP Random",
  "1279 NIEPV - South Beach Beach Vert HPhVPF",
  "1281 NIEPV - South Beach Hotel HPhVPF",
  "1283 NIEPV - South Beach Hotel PoolHP Random",
  "1285 NIEPV - South Beach Hotel BeachHP Random",
  "1287 NIEPV - South Beach Hotel Beach 2HP ...",
  "1290 NIEPV - South Beach Hotel Beach 2 Vert",
  "1292 NIEPV - PghCarWashHangout HPhHPS",
  "1295 NIEPR - LO Ambrosia Farms",
  "1298 NIEPR - LO Motel",
  "1301 NIEPC - PGH Across Police Stn",
  "1304 NIEPC - PGH Fishing Store",
  "1307 NIEPC - PGH Gas Stn",
  "1309 NIEPC - PGH Police Stn",
  "1311 NIEPC - PGH Bingo Hall",
  "1313 NIEPC - South Beach Downtown",
  "1315 NIEPC - South Beach",
  "1317 NIEPC - South Beach Park",
  "1319 NIEPC - PGHWarehousel",
  "1321 NIEPC - PGHWarehouse2",
  "1323 NIEPC - VC Suburbs North 17",
  "1325 NIEPSD - Slow Patrol - PGH",
  "1327 NIEPD - PG Docks",
  "1329 NIEPD - South Beach 01",
  "1331 NIEPD - PG River Mouth",
  "1333 NIEPD - South Beach 02",
  "1335 NIEPD - South Beach 03",
  "1337 NIEPD - PG Canal Fishing Coast 01",
  "1339 NIEPD - PG Neighbourhood Coast 01",
  "1341 NIEPD - South Beach 04",
  "1343 NIEPD - South Beach 05",
  "1345 NIEPPO - Car Pullover",
  "1347 NIEPPO - Car Pullover",
  "1349 NIEPPO - Car Pullover",
  "1351 NIEPPO - Car Pullover",
  "1353 NIEPPO - Car Pullover",
  "1356 NIEPPO - Truck Search",
  "1357 NIEPOBSouthBeachBoardwalk01RoadBikes",
  "1358 NIEPOBSouthBeachBoardwalk02RoadBikes",
  "1359 NIEPOBSouthBeachBoardwalk03RoadBikes",
  "1360 NIEPD - ATV",
  "1361 NIEPD - Truck",
  "1362 NIEPD - Mixed",
  "1363 NIEPD - Beach Trucks",
  "1364 NIERCOOT - Trailer Park 01",
  "1365 NIEREG - Port Gellhorn 01",
  "1366 NIESCF - Airfield Coast",
  "1367 NIESCF - PG Beach"
];
const DEBUG_COLORS = [
  "rgba(245,245,245,0.92)",
  "rgba(55,255,74,0.92)",
  "rgba(65,88,255,0.95)",
  "rgba(255,61,47,0.92)",
  "rgba(255,238,58,0.92)",
  "rgba(36,255,228,0.9)",
];
const DEBUG_TEMPLATES = [
  "TASKS FULL",
  "TASKS BRIEF",
  "0x000000145EA29DB0 - SP_SCRIPT_VEHICLE_{slot}",
  "FOLLOW_WAYPOINT_RECORDING:FollowRecording ({speed} {idle}/{poolMax})",
  "DRIVE_TO_POINT:Drive ({hex}): {speed} {idle}/{poolMax}",
  "Avoidance",
  "Routine",
  "Plough Through",
  "Driving Mode: PloughThrough",
  "Processes",
  "Steer For Road Edges: Task GoTo Task",
  "Steer For Buildings: Routine Routine",
  "Slow For Road Edges: Task GoTo Task",
  "Steer For Peds: Routine Routine",
  "Steer For Vehicles: Routine Routine",
  "Steer For Objects: Routine Routine",
  "Slow For Peds: Routine Routine",
  "Slow For Vehicles: Routine Routine",
  "Slow For Object: Internal NotImplemented",
  "Slow For Traffic: Routine Routine",
  "Entities",
  "Steering Entity: LOCAL_SP_SCRIPT_VEHICLE_{slot}",
  "LOCAL ped SY_IDLE upper_body idle ({idle}s) LC:{lc}m",
  "LOCAL ped SP_SCRIPT_PED_{slot}, owner id (Local Machine)",
  "Population type: POPTYPE_RANDOM_PERSCHAR_S4S_IMPORT_GARAGE_GANG_MEMBER_4",
  "Population type: Unknown type",
  "Population type: POPTYPE_MISSION(story00)WYMAN_CS Wyman Profile:WYMAN",
  "Population type: POPTYPE_MISSION(NoScript)A_F_O_BEACH_00 Profile:BeachFemaleOld",
  "SAS_IMPORT_GARAGE_GANG_MEMBER_4 Active All floor chars/Peds/Criminal",
  "LO_INT_WYMAN Active:Interstate/Perschars/Peds/lo_int_wyman",
  "Scenario:Lean_Wall_Smoke:1/2 (Inactive)",
  "TotHangOut2 [0-12-03] NOT_USING_SCHEDULE:{slot} LmdSchedule",
  "Idle: {idle} seconds while waiting on other place to go",
  "Prevented from using lower priority seats",
  "COMBAT_UPPER_BODY:Combat {upper}",
  "ADDITIONAL_COMBAT_TASK:AimingOrFiring [DontCare] {upper}",
  "WEAPON:Use {upper}",
  "GUN:CombatGraphHold1(17) SP_SCRIPT_PED_{slot} WCS_Fire_Doesn't_Want_to_fire_or_cock (NO Token)",
  "Health: 100/100 UBMotion component lksStateAnimated",
  "Health: 100.00/100.00 [ALIVE][no component][NoDamage:ProtectedArea]",
  "<H> TASK_USE_SCENARIO Loop: high_energy_searching_unarmed_upper",
  "Default (M):TASK_DO_NOTHING:Initial {idle}/{poolMax}",
  "TASK_LOCO_MOVING_STATE_MOVING normal_pa_walk_neutral {speed}m/s",
  "TASK_MOVE_STAND_STILL:Running {idle}/{poolMax} (0.000 urgency [Still])",
  "MOVE_LOCAL_MOVEMENT:Covered [ExposedAttack/Im] ({upper})",
  "MOVE_GO_TO_POINT:GoingToPoint (1.0) {upper}",
  "FOLLOW_ROUTE:FollowingRoute (1.0) {upper}",
  "MOTION_PED:MSM SyncType_None {speed}",
  "LOCO:Loco Lod(H) A: ambient_male_02 Ctl: default_drift_controller_ai_override",
  "LOCO_MOVING:Moving READY:ta_walk_fwd_left_wide",
  "ANIM_HSH: PedMotion",
  "ANIM_MSM: PedMotionRoot",
  "FSM_TRANSITION_POOL: PedMotion ({pool}/{poolMax})",
  "FSM_TRANSITION_POOL: LocomotionMotionTaskState ({pool}/{poolMax})",
  "STATE_MOTION_TASK: locoUpperBody ({upper}/{upperMax})",
  "STATE_MOTION_TASK: Loco ({pool})",
  "TASK_LOCO:State_Loco: Idle (0.000 urgency [Still])",
  "TASK_LOCO_IDLE:State Loop: normal:Idle {idle}/{poolMax}",
  "Layout: Current  LD_CNG_SAN4SAN_CUNH_DEFAULT",
  "Loadout: Current: LOADOUT_DEFAULT({slot}) - Default: LOADOUT_DEFAULT",
  "Ambient Voice: WYMAN [53 contexts][normal]",
  "Ambient Voice: PED11_TEST_FEMALE_CIV_AGGRO_WHITE_02 [417 contexts][normal]",
  "Spoken: WYMAN | UP_WYRNT_ADAD_01",
  "Cur Leon[LUN] INVESTIGATION_REQUEST_ACCEPTED! LSUSP_INIT",
  "Cur Event[None]",
  "Cur Event[None] (Blocking active - set by GameTests)",
  "Cur Response Priority[285] Source[EventResponse]",
  "Cur Response Priority[0] Source[DefaultTasking]",
  "Last Highest Priority Event: EVENT_INVESTIGATION_REQUEST_ACCEPTED",
  "Last Highest Priority Event: EVENT_SCRIPT_COMMAND:TASK_TURN_TO_FACE_ENTITY",
  "Last Highest Priority Event: None",
  "Decision Maker: Investigate <filtered: GUARDS>",
  "Decision Maker: Avoid",
  "Creator Name: PerpCharPed CPedFactory(1) bank(perpCharPed)",
  "Creator Name: SceneModule.cpp(4489): GameTests (CSceneModule::CreatePed)",
  "Inside Avoidance Area: Name(NULL) Creator(CVolumeManager::CreateVolumeAggregate)",
  "PersFlags: Guards PersChars Humans Beha_Misc",
  "Door: Unlocked  Access Flags: External",
  "TASK_LOCO_UPPERBODY_LOOP: State_Loop high_energy_searching_walk",
  "Motion Type[0.204] MotionBLD:{motion} UBMotion:{upper}",
  "TS full update: 0.000",
  "TS Event Scan: N/A | time-critical: N/A",
  "TS MotionType[0.000] Motion[{upper}] UBMotionType[{motion}]",
  "ANIMATIONS",
  "<Motion W:1.000 gameplay@locomotion@female_type@ambient03@normal@standing/idle>",
  "Anim RootBindHeight: -0.032(exported on female default skel)",
  "CurrentSkel RootBindHeight: -0.032{female default skel}",
  "TS To full update: 0 frames",
  "TS Since last full update: 0.038 seconds",
  "TS Forced anim update: NO",
  "MovePed State: KStateAnimated",
  "MovePed CurrentState: KStateAnimated",
  "Breakout Config: Default (archetype: Default) [p:0, id:1, m:false]",
  "ClosestStandardPose (tag): Pose_Standing_normal_idle",
  "Skeleton lod: 0   Visibility lod: 0",
];
const BOAT_LINES = [
  "nice weather!",
  "is that legal?",
  "we paid for the tour",
  "wave at the plane",
  "mind the wake!",
  "not a runway!",
  "tell the blimp hi",
  "we saw nothing",
  "wrong canal!",
  "five stars on boat trip",
  "scuba brothers!",
  "we are scuba brothers now",
  "jason is a cop",
  "bunny is a rider",
  "this is fine",
  "it's happening",
  "what year is this?",
  "look at the 3d underwater!",
  "not here baby",
  "don't do it",
  "do it for the memes",
  "fail",
  "look, a fail whale",
  "not what i expected",
  "four stars. maybe three",
  "that is not a bird",
  "don't touch it!",
  "almost",
  "did he just respawn?"
];
const MAP_LABELS = [
  { text: "LTF Airfield", pos: [-2850, -4300, 0.08], width: 980, color: "#40ff4f" },
  { text: "Scree Hill", pos: [-6350, 6100, 0.08], width: 820, color: "#ff3fb6" },
  {
    text: "THE GREAT PAYWALL OF GLORIANA",
    pos: [-4200, ZERO_Y, 0],
    width: MAP_W,
    color: "#ff1f1f",
    vertical: true,
    textureWidth: 4096,
    textureHeight: 320,
    fontSize: 220,
    lineWidth: 24,
  },
];

const canvas = document.querySelector("#scene");
const overlay = document.querySelector("#overlay");
const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
const ctx = overlay.getContext("2d");
const speedEl = document.querySelector("#speed");
const latitudeEl = document.querySelector("#latitude");
const longitudeEl = document.querySelector("#longitude");
const altitudeEl = document.querySelector("#altitude");
const yawEl = document.querySelector("#yaw");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const modeEl = document.querySelector("#mode");
const tilesEl = document.querySelector("#tiles");
const metarEl = document.querySelector("#metar");
const radioEl = document.querySelector("#radio");
const phoneButton = document.querySelector("#phone-button");
const radioButton = document.querySelector("#radio-button");
const weatherButton = document.querySelector("#weather");
const dayNightButton = document.querySelector("#day-night");
const resetButton = document.querySelector("#reset");
const exitButton = document.querySelector("#exit");

if (!gl) throw new Error("WebGL unavailable");

const state = {
  width: 1,
  height: 1,
  keys: new Set(),
  tiles: [],
  tileCache: new Map(),
  cameras: [],
  landmarks: [],
  landmarkModels: [],
  mapLabels: [],
  imagePanels: [],
  colors: new Map(),
  wireframes: [],
  targets: [],
  bullets: [],
  prisonTowers: [],
  prisonShots: [],
  fighterShots: [],
  iconTexture: null,
  screenshotHits: new Set(),
  particles: [],
  birds: [],
  boats: [],
  jetSkis: [],
  golfCarts: [],
  fog: [],
  stars: makeStars(230),
  fires: [],
  lightning: 0,
  lightningBolt: null,
  weatherTime: 0,
  radioTime: 0,
  radioUntil: 0,
  radioNext: 2.5,
  radioIndex: 0,
  radioQueue: [],
  eventMode: "metar",
  eventUntil: 5,
  debugUntil: 0,
  debugStarted: 0,
  debugHoldAt: 0,
  debugNext: 35,
  debugLines: [],
  blockedPopupUntil: 0,
  blockedPopupNext: 180 + Math.random() * 240,
  blockedPopupCount: 0,
  trevorTimeout: null,
  visualMode: null,
  trevorZoneActive: false,
  trevorZoneSuppressed: false,
  turbulence: 0,
  lastTurbulenceRumble: 0,
  storm: true,
  night: false,
  fogEnabled: false,
  score: 0,
  stickFlash: 0,
  deadZoneCrash: false,
  deadZoneResetAt: 0,
  frame: null,
  running: true,
  lastShot: 0,
  lastMissile: 0,
  lastTime: performance.now(),
  sound: {
    audio: null,
    context: null,
    source: null,
    master: null,
    highpass: null,
    lowpass: null,
    compressor: null,
    shaper: null,
    tremolo: null,
    tremoloGain: null,
    baseGain: 0.1,
    playing: false,
    audible: false,
    tracks: ["radio/track_01.mp3", "radio/track_02.mp3", "radio/track_03.mp3", "radio/track_04.mp3"],
    trackIndex: 0,
  },
  phone: {
    audio: null,
    context: null,
    source: null,
    gain: null,
    playing: false,
    conversationIndex: 0,
    activeConversation: null,
    lineIndex: 0,
    pauseTimeout: null,
    duckReleaseAt: 0,
    availableAt: 5,
    baseGain: 0.333,
    conversations: [
      { folder: "phone/conversation_01", count: 20 },
      { folder: "phone/conversation_02", count: 23 },
      { folder: "phone/conversation_03", count: 26 },
      { folder: "phone/conversation_04", count: 39 },
      { folder: "phone/conversation_05", count: 47 },
      { folder: "phone/conversation_06", count: 36 },
      { folder: "phone/conversation_07", count: 59 },
      { folder: "phone/conversation_08", count: 37 },
      { folder: "phone/conversation_09", count: 5 },
    ],
  },
  gamepad: {
    pad: null,
    connected: false,
    label: "",
    pitch: 0,
    roll: 0,
    yaw: 0,
    lookYaw: 0,
    lookPitch: 0,
    throttleUp: 0,
    throttleDown: 0,
    shoot: false,
    missile: false,
    iconMissile: false,
    brake: false,
    stickPressed: false,
  },
  plane: {
    pos: [-6250, 5250, 250],
    vel: [0, -92, 2],
    yaw: Math.PI,
    pitch: 0.04,
    roll: 0,
    throttle: 0.68,
    hp: 100,
  },
  airliner: {
    center: [-2500, -560, 0],
    pos: [-1400, -560, 420],
    yaw: 0,
    pitch: 0,
    roll: 0.22,
    t: 0,
  },
  blimp: {
    pos: [-3974, -7350, 190],
    yaw: 1.1,
    t: 0,
  },
  chopper: {
    pos: [-2640, 4550, 180],
    yaw: 0,
    t: 0,
  },
  cruiseShip: {
    active: false,
    direction: 1,
    t: 0,
    next: 55,
    pos: [3000, -3500, 2],
    yaw: 0,
  },
  containerShip: {
    active: true,
    direction: 1,
    t: 0,
    next: 95,
    pos: [-7000, 4500, 2],
    yaw: 0,
  },
  fighterJet: {
    active: false,
    direction: 1,
    t: 0,
    next: 260 + Math.random() * 220,
    pos: [-6250, -6750, 55],
    yaw: 0,
    pitch: 0,
    roll: 0,
    route: null,
    cooldown: 0,
  },
  keysSeaplane: {
    active: false,
    direction: 1,
    t: 0,
    next: 18,
    pos: [-6400, -7800, 4],
    yaw: 0.7,
    pitch: 0,
    roll: 0,
  },
  camera: {
    eye: [0, 0, 0],
    target: [0, 0, 0],
    lookYaw: 0,
    lookPitch: 0,
  },
};

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

const texturedProgram = createProgram(`
attribute vec3 a_position;
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_position, 1.0);
}
`, `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_alpha;
uniform float u_brightness;
varying vec2 v_uv;
void main() {
  vec4 color = texture2D(u_texture, v_uv);
  gl_FragColor = vec4(color.rgb * u_brightness, color.a * u_alpha);
}
`);

const colorProgram = createProgram(`
attribute vec3 a_position;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
}
`, `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`);

const texturedBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();
const texturedLoc = {
  position: gl.getAttribLocation(texturedProgram, "a_position"),
  uv: gl.getAttribLocation(texturedProgram, "a_uv"),
  matrix: gl.getUniformLocation(texturedProgram, "u_matrix"),
  texture: gl.getUniformLocation(texturedProgram, "u_texture"),
  alpha: gl.getUniformLocation(texturedProgram, "u_alpha"),
  brightness: gl.getUniformLocation(texturedProgram, "u_brightness"),
};
const colorLoc = {
  position: gl.getAttribLocation(colorProgram, "a_position"),
  matrix: gl.getUniformLocation(colorProgram, "u_matrix"),
  color: gl.getUniformLocation(colorProgram, "u_color"),
};

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function length(v) { return Math.hypot(v[0], v[1], v[2]); }
function normalize(v) {
  const d = length(v) || 1;
  return [v[0] / d, v[1] / d, v[2] / d];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize(subtract(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function transformPoint(matrix, point) {
  const x = point[0], y = point[1], z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  ];
}

function worldToGl(x, y, z = 0) {
  return [x, z, -y];
}

function glToWorld(v) {
  return [v[0], -v[2], v[1]];
}

function actorBasis(actor) {
  const cy = Math.cos(actor.yaw), sy = Math.sin(actor.yaw);
  const cp = Math.cos(actor.pitch), sp = Math.sin(actor.pitch);
  const forward = normalize([-sy * cp, cy * cp, sp]);
  let right = normalize([cy, sy, 0]);
  let up = normalize(cross(right, forward));
  const cr = Math.cos(actor.roll), sr = Math.sin(actor.roll);
  const rolledRight = add(scale(right, cr), scale(up, -sr));
  const rolledUp = add(scale(right, sr), scale(up, cr));
  return { forward, right: rolledRight, up: rolledUp };
}

function planeBasis() {
  return actorBasis(state.plane);
}

function directionFromYpr(ypr, u, v) {
  const yaw = (ypr[0] || 0) * Math.PI / 180;
  const pitch = (ypr[1] || 0) * Math.PI / 180;
  const roll = (ypr[2] || 0) * Math.PI / 180;
  let right = [Math.cos(yaw), Math.sin(yaw), 0];
  const forward = [-Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  let up = normalize(cross(right, forward));
  if (roll) {
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const nextRight = [
      right[0] * cr - up[0] * sr,
      right[1] * cr - up[1] * sr,
      right[2] * cr - up[2] * sr,
    ];
    const nextUp = [
      right[0] * sr + up[0] * cr,
      right[1] * sr + up[1] * cr,
      right[2] * sr + up[2] * cr,
    ];
    right = nextRight;
    up = nextUp;
  }
  return normalize(add(add(forward, scale(right, u)), scale(up, v)));
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function makeTexture(image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return texture;
}

function loadImageTexture(url) {
  const record = { loaded: false, failed: false, texture: null, width: 1, height: 1 };
  const image = new Image();
  image.onload = () => {
    record.texture = makeTexture(image);
    record.width = image.naturalWidth || image.width || 1;
    record.height = image.naturalHeight || image.height || 1;
    record.loaded = true;
  };
  image.onerror = () => {
    record.failed = true;
  };
  image.src = url;
  return record;
}

function createCanvasTexture(size, draw) {
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const offscreenCtx = offscreen.getContext("2d");
  draw(offscreenCtx, size);
  return { loaded: true, failed: false, texture: makeTexture(offscreen), width: size, height: size };
}

const fogTexture = createCanvasTexture(128, (fogCtx, size) => {
  const gradient = fogCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(235,242,250,0.55)");
  gradient.addColorStop(0.45, "rgba(220,232,246,0.28)");
  gradient.addColorStop(1, "rgba(220,232,246,0)");
  fogCtx.fillStyle = gradient;
  fogCtx.fillRect(0, 0, size, size);
});

function createTextTexture(text, color, options = {}) {
  const width = options.width || 1024;
  const height = options.height || 180;
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const labelCtx = offscreen.getContext("2d");
  labelCtx.clearRect(0, 0, width, height);
  labelCtx.font = `bold ${options.fontSize || 112}px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif`;
  labelCtx.textAlign = "center";
  labelCtx.textBaseline = "middle";
  labelCtx.lineJoin = "round";
  labelCtx.lineWidth = options.lineWidth || 14;
  labelCtx.strokeStyle = "rgba(0,0,0,0.65)";
  labelCtx.strokeText(text, width / 2, height / 2 + 4);
  labelCtx.fillStyle = color;
  labelCtx.fillText(text, width / 2, height / 2 + 4);
  return { loaded: true, failed: false, texture: makeTexture(offscreen), width, height };
}

function tileUrl(z, x, y) {
  return `${TILE_ROOT}/${z}/${z},${y},${x}.jpg`;
}

function tileWorldBounds(z, x, y) {
  const tilesPerSide = 4 * Math.pow(2, z);
  const tileMeters = MAP_W / tilesPerSide;
  const west = x * tileMeters - ZERO_X;
  const east = west + tileMeters;
  const north = ZERO_Y - y * tileMeters;
  const south = north - tileMeters;
  return { west, east, north, south };
}

function loadTiles() {
  const [[x0, y0], [x1, y1]] = TILE_RANGE;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.tiles.push(loadTileRecord(TILE_Z, x, y));
    }
  }
}

function loadTileRecord(z, x, y) {
  const tilesPerSide = 4 * Math.pow(2, z);
  if (x < 0 || y < 0 || x >= tilesPerSide || y >= tilesPerSide) return null;
  const range = TILE_RANGES[z];
  if (range && (x < range[0][0] || x > range[1][0] || y < range[0][1] || y > range[1][1])) return null;
  const key = `${z}/${x}/${y}`;
  if (state.tileCache.has(key)) return state.tileCache.get(key);
  const record = loadImageTexture(tileUrl(z, x, y));
  Object.assign(record, { z, x, y, dynamic: z > TILE_Z });
  state.tileCache.set(key, record);
  return record;
}

function worldTileAt(z, x, y) {
  const tilesPerSide = 4 * Math.pow(2, z);
  const tileMeters = MAP_W / tilesPerSide;
  return {
    x: Math.floor((x + ZERO_X) / tileMeters),
    y: Math.floor((ZERO_Y - y) / tileMeters),
  };
}

function updateDetailTiles() {
  const centers = new Map();
  for (const z of DETAIL_TILE_LEVELS) {
    const center = worldTileAt(z, state.plane.pos[0], state.plane.pos[1]);
    centers.set(z, center);
    const scale = Math.pow(2, DETAIL_TILE_Z - z);
    const radius = Math.max(2, Math.ceil(DETAIL_TILE_RADIUS / scale));
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        const tile = loadTileRecord(z, x, y);
        if (tile && !state.tiles.includes(tile)) state.tiles.push(tile);
      }
    }
  }
  state.tiles = state.tiles.filter((tile) => {
    if (!tile || tile.failed) return false;
    if (!tile.dynamic) return true;
    const center = centers.get(tile.z);
    if (!center) return false;
    const scale = Math.pow(2, DETAIL_TILE_Z - tile.z);
    const keepRadius = Math.max(3, Math.ceil(DETAIL_TILE_KEEP_RADIUS / scale));
    return Math.abs(tile.x - center.x) <= keepRadius && Math.abs(tile.y - center.y) <= keepRadius;
  });
}

function drawTextured(vertices, texture, matrix, alpha = 1, brightness = 1) {
  if (!texture) return;
  gl.useProgram(texturedProgram);
  gl.uniformMatrix4fv(texturedLoc.matrix, false, matrix);
  gl.uniform1f(texturedLoc.alpha, alpha);
  gl.uniform1f(texturedLoc.brightness, brightness);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(texturedLoc.texture, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, texturedBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(texturedLoc.position);
  gl.vertexAttribPointer(texturedLoc.position, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(texturedLoc.uv);
  gl.vertexAttribPointer(texturedLoc.uv, 2, gl.FLOAT, false, 20, 12);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
}

function drawColor(vertices, color, matrix, mode = gl.TRIANGLES) {
  if (!vertices.length) return;
  gl.useProgram(colorProgram);
  gl.uniformMatrix4fv(colorLoc.matrix, false, matrix);
  gl.uniform4f(colorLoc.color, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(colorLoc.position);
  gl.vertexAttribPointer(colorLoc.position, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(mode, 0, vertices.length / 3);
}

function colorForName(name) {
  return state.colors.get(name) || [1, 1, 1];
}

function mapColor(color) {
  if (!state.night) return color;
  return [color[0] * NIGHT_MAP_BRIGHTNESS, color[1] * NIGHT_MAP_BRIGHTNESS, color[2] * NIGHT_MAP_BRIGHTNESS, color[3]];
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function drawTile(tile, matrix) {
  if (!tile?.loaded) return;
  const { west, east, north, south } = tileWorldBounds(tile.z, tile.x, tile.y);
  drawTextured([
    west, -0.04, -north, 0, 1,
    east, -0.04, -north, 1, 1,
    east, -0.04, -south, 1, 0,
    west, -0.04, -north, 0, 1,
    east, -0.04, -south, 1, 0,
    west, -0.04, -south, 0, 0,
  ], tile.texture, matrix, 1, state.night ? NIGHT_MAP_BRIGHTNESS : 1);
}

function mapLabelVertices(label) {
  const aspect = label.texture.width / label.texture.height;
  const width = label.width;
  const height = width / aspect;
  const halfW = width / 2;
  const halfH = height / 2;
  const [x, y, z] = label.pos;
  if (label.vertical) {
    const west = x - halfW;
    const east = x + halfW;
    const top = z + height;
    return [
      ...worldToGl(west, y, top), 0, 1,
      ...worldToGl(east, y, top), 1, 1,
      ...worldToGl(east, y, z), 1, 0,
      ...worldToGl(west, y, top), 0, 1,
      ...worldToGl(east, y, z), 1, 0,
      ...worldToGl(west, y, z), 0, 0,
    ];
  }
  const west = x - halfW;
  const east = x + halfW;
  const north = y + halfH;
  const south = y - halfH;
  return [
    ...worldToGl(west, north, z), 0, 1,
    ...worldToGl(east, north, z), 1, 1,
    ...worldToGl(east, south, z), 1, 0,
    ...worldToGl(west, north, z), 0, 1,
    ...worldToGl(east, south, z), 1, 0,
    ...worldToGl(west, south, z), 0, 0,
  ];
}

function drawMapLabels(matrix) {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const label of state.mapLabels) {
    drawTextured(label.vertices, label.texture.texture, matrix, 1);
  }
  gl.disable(gl.BLEND);
}

function imagePanelVertices(panel) {
  return [
    ...worldToGl(panel.x, panel.north, panel.top), 1, 1,
    ...worldToGl(panel.x, panel.south, panel.top), 0, 1,
    ...worldToGl(panel.x, panel.south, panel.bottom), 0, 0,
    ...worldToGl(panel.x, panel.north, panel.top), 1, 1,
    ...worldToGl(panel.x, panel.south, panel.bottom), 0, 0,
    ...worldToGl(panel.x, panel.north, panel.bottom), 1, 0,
  ];
}

function drawImagePanels(matrix) {
  for (const panel of state.imagePanels) {
    if (!panel.texture?.loaded) continue;
    drawTextured(imagePanelVertices(panel), panel.texture.texture, matrix, 1);
  }
}

function initializeMapLabels() {
  state.mapLabels = MAP_LABELS.map((label) => {
    const texture = createTextTexture(label.text, label.color, {
      width: label.textureWidth,
      height: label.textureHeight,
      fontSize: label.fontSize,
      lineWidth: label.lineWidth,
    });
    return {
      ...label,
      texture,
      vertices: mapLabelVertices({ ...label, texture }),
    };
  });
}

function initializeImagePanels() {
  const margin = 25;
  const gap = 25;
  const totalWidth = SCHLOTT_PANEL_NORTH - SCHLOTT_PANEL_SOUTH;
  const availableWidth = totalWidth - margin * 2 - gap;
  const slotAspect = 1920 / 1080;
  const operationAspect = 1;
  const height = availableWidth / (slotAspect + operationAspect);
  const slotWidth = height * slotAspect;
  const operationWidth = height * operationAspect;
  const south = SCHLOTT_PANEL_SOUTH + margin;
  const split = south + slotWidth;
  const operationSouth = split + gap;
  state.imagePanels = [
    {
      x: SCHLOTT_PANEL_X,
      south,
      north: split,
      bottom: margin,
      top: margin + height,
      texture: loadImageTexture("images/schlott.png"),
    },
    {
      x: SCHLOTT_PANEL_X,
      south: operationSouth,
      north: operationSouth + operationWidth,
      bottom: margin,
      top: margin + height,
      texture: loadImageTexture("images/operation%20schlott.png"),
    },
  ];
}

function drawWater(matrix) {
  const e = 250000;
  drawColor([
    -e, -2, -e, e, -2, -e, e, -2, e,
    -e, -2, -e, e, -2, e, -e, -2, e,
  ], mapColor(WATER_COLOR), matrix);
}

function resetPlane() {
  Object.assign(state.plane, {
    pos: [-6250, 5250, 250],
    vel: [0, -92, 2],
    yaw: Math.PI,
    pitch: 0.04,
    roll: 0,
    throttle: 0.68,
    hp: 100,
  });
  state.deadZoneCrash = false;
  state.deadZoneResetAt = 0;
  statusEl.textContent = "fresh floatplane, highly legal";
}

function makeStars(count) {
  const stars = [];
  let seed = 73491;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const yaw = random() * Math.PI * 2;
    const elevation = 0.18 + Math.pow(random(), 0.72) * 0.82;
    const horizontal = Math.cos(elevation);
    const bright = random() > 0.84;
    stars.push({
      dir: [Math.cos(yaw) * horizontal, Math.sin(yaw) * horizontal, Math.sin(elevation)],
      size: bright ? 2.2 + random() * 1.8 : 0.9 + random() * 1.7,
      alpha: bright ? 0.74 + random() * 0.22 : 0.42 + random() * 0.48,
    });
  }
  return stars;
}

function shoot(now) {
  if (now - state.lastShot < 95) return;
  state.lastShot = now;
  const { forward } = planeBasis();
  state.bullets.push({
    type: "bullet",
    pos: add(state.plane.pos, scale(forward, 18)),
    vel: add(state.plane.vel, scale(forward, BULLET_SPEED)),
    life: 2.1,
    radius: 0,
  });
  spawnParticles(add(state.plane.pos, scale(forward, 16)), [1, 0.86, 0.32, 1], 8, 22);
}

function launchMissile(now, variant = "missile") {
  if (now - state.lastMissile < 650) return;
  state.lastMissile = now;
  const { forward, up } = planeBasis();
  state.bullets.push({
    type: variant,
    pos: add(add(state.plane.pos, scale(forward, 20)), scale(up, -2)),
    vel: add(state.plane.vel, scale(forward, 310)),
    life: 4.5,
    radius: 20,
  });
  spawnParticles(add(state.plane.pos, scale(forward, 18)), [1, 0.35, 0.08, 1], 18, 34);
}

function spawnParticles(pos, color, count, speed = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI - Math.PI / 2;
    state.particles.push({
      pos: [...pos],
      vel: [Math.cos(a) * Math.cos(b) * speed * Math.random(), Math.sin(a) * Math.cos(b) * speed * Math.random(), Math.sin(b) * speed * Math.random()],
      color,
      life: 0.4 + Math.random() * 0.9,
      size: 2 + Math.random() * 4,
    });
  }
}

function seedFog() {
  state.fog = [];
  for (let i = 0; i < 48; i++) {
    state.fog.push(makeFogPatch(true));
  }
}

function makeFogPatch(wide = false) {
  const angle = Math.random() * Math.PI * 2;
  const radius = wide ? 60 + Math.random() * 520 : 180 + Math.random() * 460;
  const forwardBias = planeBasis().forward;
  const ahead = wide ? -60 + Math.random() * 460 : 80 + Math.random() * 620;
  const base = add(state.plane.pos, scale(forwardBias, ahead));
  return {
    pos: [
      base[0] + Math.cos(angle) * radius,
      base[1] + Math.sin(angle) * radius,
      Math.max(24, state.plane.pos[2] - 105 + Math.random() * 250),
    ],
    size: 150 + Math.random() * 310,
    alpha: 0.13 + Math.random() * 0.17,
    drift: [-8 - Math.random() * 18, -18 - Math.random() * 22, (Math.random() - 0.5) * 3],
  };
}

function igniteFourSeasons() {
  if (state.fires.some((fire) => fire.name === FOUR_SEASONS_NAME)) return;
  const landmark = state.landmarks.find((item) => item.name === FOUR_SEASONS_NAME);
  if (!landmark?.xyz) return;
  state.fires.push({ name: FOUR_SEASONS_NAME, pos: [landmark.xyz[0], landmark.xyz[1], landmark.xyz[2] + 35], radius: 135, height: 90, rate: 95, life: 999 });
  statusEl.textContent = "Four Seasons: unfortunately flambé";
}

function turbulenceFactor(pos) {
  const north = smoothstep(TURBULENCE_NORTH_START, TURBULENCE_NORTH_FULL, pos[1]);
  const mountainBias = 0.55 + 0.45 * smoothstep(-1800, -5200, pos[0]);
  const deadZone = 1 + smoothstep(DEAD_ZONE_START, DEAD_ZONE_FULL, pos[1]);
  return north * mountainBias * deadZone;
}

function updateRadioVolume() {
  const sound = state.sound;
  if (!sound.master || !sound.audible) return;
  const weatherGain = 1 - 0.5 * clamp(state.turbulence, 0, 1);
  const phoneDuckGain = state.phone.playing || state.weatherTime < state.phone.duckReleaseAt ? 0.2 : 1;
  const targetGain = sound.baseGain * weatherGain * phoneDuckGain;
  sound.master.gain.setTargetAtTime(targetGain, sound.context.currentTime, 0.5);
}

function updatePhoneButtonVisibility() {
  const visible = state.phone.playing || state.weatherTime >= state.phone.availableAt;
  phoneButton.hidden = !visible;
  phoneButton.disabled = !visible;
}

function updatePhoneVolume() {
  const phone = state.phone;
  if (!phone.gain) return;
  const deadZoneGain = state.plane.pos[1] > DEAD_ZONE_START ? 0.5 : 1;
  phone.gain.gain.setTargetAtTime(phone.baseGain * deadZoneGain, phone.context.currentTime, 0.5);
}

function isInTrevorFlickerZone(pos) {
  return pos[0] >= TREVOR_FLICKER_ZONE.west &&
    pos[0] <= TREVOR_FLICKER_ZONE.east &&
    pos[1] >= TREVOR_FLICKER_ZONE.south &&
    pos[1] <= TREVOR_FLICKER_ZONE.north;
}

function updateTrevorClass() {
  const zoneFlickerOn = state.trevorZoneActive &&
    !state.trevorZoneSuppressed &&
    Math.floor(state.weatherTime * 20) % 2 === 0;
  const activeMode = zoneFlickerOn ? "trevor" : state.visualMode;
  for (const mode of VISUAL_MODE_CLASSES) {
    document.body.classList.toggle(mode, activeMode === mode);
  }
}

function updateTrevorZone() {
  const active = isInTrevorFlickerZone(state.plane.pos);
  if (active && !state.trevorZoneActive) state.trevorZoneSuppressed = false;
  if (!active) state.trevorZoneSuppressed = false;
  state.trevorZoneActive = active;
  updateTrevorClass();
}

function updatePlane(dt, now) {
  const p = state.plane;
  pollGamepad();
  const deadZoneWarning = smoothstep(DEAD_ZONE_START, DEAD_ZONE_FULL, p.pos[1]);
  if (p.pos[1] > DEAD_ZONE_START && Math.random() < dt * (0.7 + deadZoneWarning * 2.4)) {
    state.stickFlash = Math.max(state.stickFlash, 0.35 + Math.random() * 0.45);
  }
  if (p.pos[1] > DEAD_ZONE_FULL) state.deadZoneCrash = true;
  const controlsEnabled = !state.deadZoneCrash;
  const pitchInput = controlsEnabled ? keyAxis("w", "s") + state.gamepad.pitch : 0;
  const rollInput = controlsEnabled ? keyAxis("d", "a") + state.gamepad.roll : 0;
  const yawInput = controlsEnabled ? state.gamepad.yaw : 0;
  const throttleUp = controlsEnabled ? (state.keys.has("e") || state.keys.has("E") ? 1 : 0) + state.gamepad.throttleUp : 0;
  const throttleDown = controlsEnabled ? (state.keys.has("q") || state.keys.has("Q") ? 1 : 0) + state.gamepad.throttleDown : 1;
  const accelInput = clamp(throttleUp - throttleDown, -1, 1);
  p.throttle += dt * (0.55 * throttleUp - 0.6 * throttleDown);
  p.throttle = clamp(p.throttle, 0, 1);
  p.roll += clamp(rollInput, -1, 1) * dt * 1.35;
  p.pitch += clamp(pitchInput, -1, 1) * dt * 0.75;
  p.yaw += clamp(yawInput, -1, 1) * dt * 0.9;
  if (controlsEnabled && (state.keys.has("b") || state.keys.has("B") || state.gamepad.brake)) p.vel = scale(p.vel, 0.965);
  if (controlsEnabled && (state.keys.has(" ") || state.gamepad.shoot)) shoot(now);
  if (controlsEnabled && (state.keys.has("m") || state.keys.has("M") || state.keys.has("z") || state.keys.has("Z") || state.keys.has("c") || state.keys.has("C") || state.gamepad.missile)) launchMissile(now);
  if (controlsEnabled && (state.keys.has("x") || state.keys.has("X") || state.gamepad.iconMissile)) launchMissile(now, "icon-missile");
  p.roll *= Math.pow(0.86, dt * 5);
  p.pitch = clamp(p.pitch, -0.85, 0.82);
  const { forward, up } = planeBasis();
  const speed = length(p.vel);
  p.yaw -= p.roll * clamp(speed / 95, 0.35, 1.45) * dt * 0.82;
  const lift = Math.min(58, speed * speed * 0.0065);
  const diveAccel = Math.max(0, -forward[2]) * DIVE_ACCEL;
  p.vel = add(p.vel, scale(forward, (THROTTLE_FORCE * p.throttle + Math.max(0, accelInput) * 18 + diveAccel) * dt));
  if (accelInput < 0) p.vel = scale(p.vel, Math.pow(0.985, -accelInput * dt * 60));
  p.vel[2] += (lift * (0.35 + Math.max(-0.2, forward[2])) - GRAVITY * 0.34) * dt;
  if (state.storm) {
    const gust = Math.sin(now * 0.0017) * 0.55 + Math.sin(now * 0.0041) * 0.22;
    p.vel[0] += Math.cos(now * 0.0013) * gust * dt * 9;
    p.vel[1] += Math.sin(now * 0.0011) * gust * dt * 9;
    p.roll += gust * dt * 0.16;
  }
  if (state.deadZoneCrash) {
    p.throttle = 0;
    p.pitch = lerp(p.pitch, -0.72, 1 - Math.pow(0.025, dt));
    p.roll += Math.sin(now * 0.006) * dt * 0.8;
    p.vel[2] -= (84 + Math.min(120, speed * 0.44)) * dt;
    p.vel[0] *= Math.pow(0.991, dt * 60);
    p.vel[1] *= Math.pow(0.991, dt * 60);
    if (Math.random() < dt * 36) spawnParticles(p.pos, [0.9, 0.76, 0.48, 0.78], 2, 28);
    statusEl.textContent = "dead zone: controls offline";
  }
  const turbulence = turbulenceFactor(p.pos);
  state.turbulence = lerp(state.turbulence, turbulence, 1 - Math.pow(0.18, dt));
  if (state.turbulence > 0.01) {
    const t = now * 0.001;
    const nx = Math.sin(t * 2.7 + p.pos[1] * 0.006) + Math.sin(t * 5.1 + p.pos[0] * 0.003) * 0.42;
    const ny = Math.cos(t * 2.2 + p.pos[0] * 0.005) + Math.sin(t * 4.3 + p.pos[1] * 0.002) * 0.35;
    const nz = Math.sin(t * 3.9 + p.pos[0] * 0.004 + p.pos[1] * 0.003);
    p.vel[0] += nx * state.turbulence * dt * 28;
    p.vel[1] += ny * state.turbulence * dt * 28;
    p.vel[2] += nz * state.turbulence * dt * 20;
    p.roll += (nx * 0.34 + ny * 0.18) * state.turbulence * dt;
    p.pitch += nz * state.turbulence * dt * 0.16;
    if (state.gamepad.connected && state.turbulence > 0.24 && state.weatherTime > state.lastTurbulenceRumble + 0.34) {
      const bump = 0.45 + 0.55 * Math.abs(nz);
      rumbleGamepad(110, 0.08 * state.turbulence * bump, 0.32 * state.turbulence * bump);
      state.lastTurbulenceRumble = state.weatherTime;
    }
  }
  p.vel = scale(p.vel, Math.pow(DRAG, dt * 60));
  if (controlsEnabled && throttleDown > 0) {
    const brakeSpeed = length(p.vel);
    if (brakeSpeed < MIN_BRAKE_SPEED) p.vel = scale(brakeSpeed > 0.001 ? normalize(p.vel) : forward, MIN_BRAKE_SPEED);
  }
  p.pos = add(p.pos, scale(p.vel, dt));
  if (p.pos[2] < 7) {
    p.pos[2] = 7;
    if (p.vel[2] < -4) {
      p.vel[2] = Math.abs(p.vel[2]) * 0.45;
      p.vel[0] *= 0.72;
      p.vel[1] *= 0.72;
      spawnParticles(p.pos, [0.9, 0.76, 0.48, 1], 22, 26);
      statusEl.textContent = "bonk";
      if (state.deadZoneCrash && !state.deadZoneResetAt) {
        state.deadZoneResetAt = state.weatherTime + 1;
        if (state.phone.playing) stopPhone("phone: signal lost");
        p.vel = [0, 0, 0];
        statusEl.textContent = "signal lost";
      }
    }
  }
  const fs = state.landmarks.find((item) => item.name === FOUR_SEASONS_NAME);
  if (fs?.xyz && Math.hypot(p.pos[0] - fs.xyz[0], p.pos[1] - fs.xyz[1], p.pos[2] - fs.xyz[2]) < 90) {
    igniteFourSeasons();
    p.vel = scale(p.vel, -0.22);
    p.pos = add(p.pos, scale(normalize(subtract(p.pos, fs.xyz)), 42));
    spawnParticles(p.pos, [1, 0.25, 0.05, 1], 48, 46);
  }
  updateTrevorZone();
}

function keyAxis(positiveKey, negativeKey) {
  const positive = state.keys.has(positiveKey) || state.keys.has(positiveKey.toUpperCase()) ? 1 : 0;
  const negative = state.keys.has(negativeKey) || state.keys.has(negativeKey.toUpperCase()) ? 1 : 0;
  return positive - negative;
}

function applyDeadzone(value, deadzone = 0.12) {
  if (Math.abs(value) < deadzone) return 0;
  const sign = Math.sign(value);
  return sign * (Math.abs(value) - deadzone) / (1 - deadzone);
}

function pollGamepad() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pad = pads[0];
  if (!pad) {
    state.gamepad.pad = null;
    state.gamepad.connected = false;
    state.gamepad.label = "";
    state.gamepad.pitch = 0;
    state.gamepad.roll = 0;
    state.gamepad.yaw = 0;
    state.gamepad.lookYaw = 0;
    state.gamepad.lookPitch = 0;
    state.gamepad.throttleUp = 0;
    state.gamepad.throttleDown = 0;
    state.gamepad.shoot = false;
    state.gamepad.missile = false;
    state.gamepad.iconMissile = false;
    state.gamepad.brake = false;
    state.gamepad.stickPressed = false;
    return;
  }
  state.gamepad.pad = pad;
  state.gamepad.connected = true;
  state.gamepad.label = pad.id || "gamepad";
  state.gamepad.roll = applyDeadzone(pad.axes[0] || 0);
  state.gamepad.pitch = applyDeadzone(pad.axes[1] || 0);
  state.gamepad.yaw = 0;
  state.gamepad.lookYaw = applyDeadzone(pad.axes[2] || 0);
  state.gamepad.lookPitch = applyDeadzone(-(pad.axes[3] || 0));
  state.gamepad.throttleDown = Math.max(pad.buttons[4]?.value || 0, pad.buttons[6]?.value || 0);
  state.gamepad.throttleUp = Math.max(pad.buttons[5]?.value || 0, pad.buttons[7]?.value || 0);
  state.gamepad.shoot = Boolean(pad.buttons[0]?.pressed);
  state.gamepad.missile = Boolean(pad.buttons[1]?.pressed || pad.buttons[2]?.pressed);
  state.gamepad.iconMissile = Boolean(pad.buttons[3]?.pressed);
  state.gamepad.brake = false;
  const stickPressed = Boolean(pad.buttons[10]?.pressed || pad.buttons[11]?.pressed);
  if (stickPressed && !state.gamepad.stickPressed) {
    state.stickFlash = 1;
    statusEl.textContent = "stick click: absolutely acknowledged";
  }
  state.gamepad.stickPressed = stickPressed;
}

function rumbleGamepad(duration = 180, weakMagnitude = 0.35, strongMagnitude = 0.9) {
  const pad = state.gamepad.pad || (navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null);
  if (!pad) return;
  if (pad.vibrationActuator?.playEffect) {
    pad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration,
      weakMagnitude,
      strongMagnitude,
    }).catch(() => {});
    return;
  }
  if (pad.hapticActuators?.[0]?.pulse) {
    pad.hapticActuators[0].pulse(strongMagnitude, duration).catch(() => {});
  }
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.life -= dt;
    if (bullet.type === "missile") {
      const target = state.targets.find((item) => !item.dead);
      if (target) {
        const speed = length(bullet.vel);
        const desired = normalize(subtract(target.pos, bullet.pos));
        bullet.vel = scale(normalize(add(scale(normalize(bullet.vel), 0.94), scale(desired, 0.06))), speed);
      }
      if (Math.random() < dt * 38) spawnParticles(bullet.pos, [0.08, 0.08, 0.08, 0.5], 1, 8);
    }
    bullet.pos = add(bullet.pos, scale(bullet.vel, dt));
    for (const target of state.targets) {
      if (target.dead) continue;
      if (Math.hypot(bullet.pos[0] - target.pos[0], bullet.pos[1] - target.pos[1], bullet.pos[2] - target.pos[2]) < target.radius + (bullet.radius || 0)) {
        target.dead = true;
        bullet.life = 0;
        state.score += bullet.type === "missile" ? 250 : 100;
        spawnParticles(target.pos, bullet.type === "missile" ? [1, 0.32, 0.06, 1] : [0.4, 1, 0.7, 1], bullet.type === "missile" ? 90 : 48, bullet.type === "missile" ? 80 : 55);
        statusEl.textContent = bullet.type === "missile" ? `missile hit: ${target.name}` : `target deleted: ${target.name}`;
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
  if (state.targets.every((target) => target.dead)) makeTargets();
}

function updateFighterShots(dt) {
  const plane = state.plane.pos;
  for (const shot of state.fighterShots) {
    shot.life -= dt;
    const speed = length(shot.vel);
    const desired = normalize(subtract(add(plane, scale(state.plane.vel, 0.35)), shot.pos));
    shot.vel = scale(normalize(add(scale(normalize(shot.vel), 0.95), scale(desired, 0.05))), speed);
    shot.pos = add(shot.pos, scale(shot.vel, dt));
    if (Math.random() < dt * 12) spawnParticles(shot.pos, [0.52, 0.54, 0.55, 0.42], 1, 7);
    if (Math.hypot(shot.pos[0] - plane[0], shot.pos[1] - plane[1], shot.pos[2] - plane[2]) < 24) {
      shot.life = 0;
      state.plane.vel = add(state.plane.vel, scale(normalize(subtract(plane, shot.pos)), 22));
      spawnParticles(plane, [0.52, 0.54, 0.55, 0.88], 28, 46);
      statusEl.textContent = "fighter intercept: rude but accurate";
      rumbleGamepad(150, 0.18, 0.52);
    }
  }
  state.fighterShots = state.fighterShots.filter((shot) => shot.life > 0);
}

function updatePrisonDefense(dt) {
  if (!state.prisonTowers.length) return;
  const plane = state.plane.pos;
  for (const tower of state.prisonTowers) {
    const horizontal = Math.hypot(plane[0] - tower.pos[0], plane[1] - tower.pos[1]);
    if (horizontal > PRISON_DEFENSE_RADIUS) continue;
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const aim = add(plane, scale(state.plane.vel, 0.42));
    const dir = normalize(subtract(aim, tower.pos));
    state.prisonShots.push({
      pos: [...tower.pos],
      vel: scale(dir, PRISON_SHOT_SPEED + Math.random() * 45),
      life: 3.4,
    });
    tower.cooldown = 0.32 + Math.random() * 1.1;
    if (Math.random() < 0.4) spawnParticles(tower.pos, [0.05, 0.12, 0.42, 0.8], 4, 14);
  }
  for (const shot of state.prisonShots) {
    shot.life -= dt;
    shot.pos = add(shot.pos, scale(shot.vel, dt));
    if (Math.random() < dt * 18) spawnParticles(shot.pos, [0.05, 0.1, 0.38, 0.55], 1, 5);
    if (Math.hypot(shot.pos[0] - plane[0], shot.pos[1] - plane[1], shot.pos[2] - plane[2]) < 22) {
      shot.life = 0;
      state.plane.vel = add(state.plane.vel, scale(normalize(subtract(plane, shot.pos)), 18));
      spawnParticles(plane, [0.04, 0.12, 0.55, 0.9], 24, 40);
      statusEl.textContent = "prison tower says no";
      rumbleGamepad(120, 0.16, 0.42);
    }
  }
  state.prisonShots = state.prisonShots.filter((shot) => shot.life > 0);
}

function spawnBirdFlock() {
  const { forward, right, up } = planeBasis();
  const count = 2 + Math.floor(Math.random() * 4);
  const center = add(add(add(state.plane.pos, scale(forward, 260 + Math.random() * 480)), scale(right, (Math.random() - 0.5) * 520)), scale(up, 60 + Math.random() * 140));
  const direction = normalize(add(scale(forward, -0.25 + Math.random() * 0.5), scale(right, Math.random() < 0.5 ? -1 : 1)));
  for (let i = 0; i < count; i++) {
    state.birds.push({
      pos: add(center, [i * 18 + (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 16]),
      vel: scale(direction, 24 + Math.random() * 18),
      phase: Math.random() * Math.PI * 2,
      size: 5 + Math.random() * 3,
      life: 7 + Math.random() * 4,
    });
  }
}

function updateBirds(dt) {
  if (state.birds.length < 14 && Math.random() < dt * 0.062) spawnBirdFlock();
  for (const bird of state.birds) {
    bird.life -= dt;
    bird.phase += dt * 8;
    bird.pos = add(bird.pos, scale(bird.vel, dt));
    bird.pos[2] += Math.sin(bird.phase) * dt * 2.2;
  }
  state.birds = state.birds.filter((bird) => bird.life > 0 && Math.hypot(bird.pos[0] - state.plane.pos[0], bird.pos[1] - state.plane.pos[1], bird.pos[2] - state.plane.pos[2]) < 1600);
}

function updateParticles(dt) {
  state.weatherTime += dt;
  updateBirds(dt);
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.pos = add(particle.pos, scale(particle.vel, dt));
    particle.vel[2] += (particle.color[0] > 0.9 ? 10 : -18) * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
  if (state.storm && Math.random() < dt * 90) {
    const p = state.plane.pos;
    state.particles.push({
      pos: [p[0] + (Math.random() - 0.5) * 620, p[1] + (Math.random() - 0.5) * 620, p[2] + 240 + Math.random() * 140],
      vel: [-70, -100, -390],
      color: [0.62, 0.75, 1, 0.45],
      life: 1.4,
      size: 1,
    });
  }
  if (state.storm && Math.random() < dt * 0.32) {
    state.lightning = 0.24;
    state.lightningBolt = {
      x: 0.15 + Math.random() * 0.7,
      y: 0.04 + Math.random() * 0.24,
      bend: Math.random() * 0.25 - 0.125,
    };
    rumbleGamepad();
    statusEl.textContent = "weather: tasteful apocalypse";
  }
  state.lightning = Math.max(0, state.lightning - dt);
  if (!state.lightning) state.lightningBolt = null;
  updateFog(dt);
  for (const fire of state.fires) {
    if (Math.random() < dt * (fire.rate || 45)) {
      const radius = fire.radius || 80;
      const height = fire.height || 40;
      spawnParticles([fire.pos[0] + (Math.random() - 0.5) * radius, fire.pos[1] + (Math.random() - 0.5) * radius, fire.pos[2] + Math.random() * height], [1, 0.27 + Math.random() * 0.35, 0.04, 0.82], 2, 24);
      spawnParticles([fire.pos[0] + (Math.random() - 0.5) * radius * 1.15, fire.pos[1] + (Math.random() - 0.5) * radius * 1.15, fire.pos[2] + height * 0.25 + Math.random() * height], [0.1, 0.1, 0.1, 0.45], 1, 14);
    }
  }
}

function updateFog(dt) {
  if (!state.storm || !state.fogEnabled) return;
  if (!state.fog.length) seedFog();
  for (let i = 0; i < state.fog.length; i++) {
    const patch = state.fog[i];
    patch.pos = add(patch.pos, scale(patch.drift, dt));
    const dx = patch.pos[0] - state.plane.pos[0];
    const dy = patch.pos[1] - state.plane.pos[1];
    const dz = patch.pos[2] - state.plane.pos[2];
    if (Math.hypot(dx, dy, dz * 0.7) > 1100) state.fog[i] = makeFogPatch(false);
  }
}

function updateCamera(dt) {
  const { forward, up } = planeBasis();
  const right = normalize(cross(forward, up));
  if (state.keys.has("ArrowLeft")) state.camera.lookYaw -= dt * 1.8;
  if (state.keys.has("ArrowRight")) state.camera.lookYaw += dt * 1.8;
  if (state.keys.has("ArrowUp")) state.camera.lookPitch += dt * 1.2;
  if (state.keys.has("ArrowDown")) state.camera.lookPitch -= dt * 1.2;
  state.camera.lookYaw += state.gamepad.lookYaw * dt * 1.8;
  state.camera.lookPitch += state.gamepad.lookPitch * dt * 1.2;
  state.camera.lookYaw = clamp(state.camera.lookYaw, -1.05, 1.05) * Math.pow(0.965, dt * 60);
  state.camera.lookPitch = clamp(state.camera.lookPitch, -0.68, 0.68) * Math.pow(0.965, dt * 60);
  let desiredEye = add(add(state.plane.pos, scale(forward, -CAMERA_CHASE * 0.98)), scale(up, CAMERA_UP + 24 + length(state.plane.vel) * 0.025));
  desiredEye[2] = Math.max(desiredEye[2], state.plane.pos[2] + 16);
  const lookOffset = add(add(scale(forward, 20), scale(right, state.camera.lookYaw * 32)), scale(up, state.camera.lookPitch * 24));
  let desiredTarget = add(state.plane.pos, lookOffset);
  if (state.turbulence > 0.01) {
    const t = state.weatherTime;
    const shake = state.turbulence * (0.8 + Math.min(2.2, length(state.plane.vel) * 0.012));
    const jitter = add(scale(right, Math.sin(t * 18.7) * shake), scale(up, Math.cos(t * 23.3) * shake * 0.65));
    desiredEye = add(desiredEye, jitter);
    desiredTarget = add(desiredTarget, scale(jitter, 0.38));
  }
  desiredTarget[2] = Math.max(0, desiredTarget[2]);
  state.camera.eye = lerp3(state.camera.eye, desiredEye, 0.97);
  state.camera.target = lerp3(state.camera.target, add(desiredTarget, scale(right, state.plane.roll * 0.28)), 0.96);
}

function writeMap3dPose() {
  sessionStorage.setItem(MAP3D_POSE_STORAGE_KEY, JSON.stringify({
    eye: worldToGl(...state.camera.eye),
    target: worldToGl(...state.camera.target),
    vfov: 45,
  }));
}

function stopGameLoop() {
  state.running = false;
  if (state.frame) {
    cancelAnimationFrame(state.frame);
    state.frame = null;
  }
}

function updateAirliner(dt) {
  const jet = state.airliner;
  jet.t += dt * 0.075;
  const rx = 1120;
  const ry = 760;
  const angle = jet.t;
  const z = 430 + Math.sin(angle * 2.0) * 24;
  const x = jet.center[0] + Math.cos(angle) * rx;
  const y = jet.center[1] + Math.sin(angle) * ry;
  const dx = -Math.sin(angle) * rx;
  const dy = Math.cos(angle) * ry;
  jet.pos = [x, y, z];
  jet.yaw = Math.atan2(-dx, dy);
  jet.pitch = Math.sin(angle * 2.0 + Math.PI / 2) * 0.025;
  jet.roll = -0.26;
}

function updateAmbientActors(dt) {
  state.blimp.t += dt * 0.18;
  state.blimp.pos[2] = 190 + Math.sin(state.blimp.t) * 8;
  state.blimp.yaw = 1.1 + Math.sin(state.blimp.t * 0.35) * 0.08;

  state.chopper.t += dt;
  const chopperAngle = state.chopper.t * 0.42;
  state.chopper.pos = [-2640 + Math.cos(chopperAngle) * 110, 4550 + Math.sin(chopperAngle) * 80, 175 + Math.sin(state.chopper.t * 1.6) * 7];
  state.chopper.yaw = chopperAngle + Math.PI / 2;

  updateKeysSeaplane(dt);
  updateFighterJet(dt);
  updateRouteShip(dt, state.cruiseShip, [[3000, -3500, 2], [500, -5500, 2], [-500, -7500, 2]], 0.0048, 180, 260);
  updateRouteShip(dt, state.containerShip, [[-7000, 4500, 2], [-8500, 3500, 2], [-10500, 4500, 2]], 0.0038, 220, 320);

  for (const boat of state.boats) {
    boat.t = (boat.t + dt * boat.speed) % 1;
    const a = boat.route[0];
    const b = boat.route[1];
    const t = boat.t < 0.5 ? boat.t * 2 : (1 - boat.t) * 2;
    const from = boat.t < 0.5 ? a : b;
    const to = boat.t < 0.5 ? b : a;
    boat.pos = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), 1.6];
    boat.yaw = Math.atan2(-(to[0] - from[0]), to[1] - from[1]);
    if (Math.random() < dt * 0.018) {
      boat.message = BOAT_LINES[Math.floor(Math.random() * BOAT_LINES.length)];
      boat.messageUntil = state.weatherTime + 3.5;
    }
  }

  updateJetSkis(dt);
  updateGolfCarts(dt);
}

function fighterRoutePoint(route, t) {
  return quadraticRoutePoint(route, t, 1);
}

function scheduleNextFighterJet() {
  state.fighterJet.next = 480 + Math.random() * 520;
}

function spawnFighterJet() {
  const jet = state.fighterJet;
  const airbase = [-6250, -6750, 55];
  const spaceCenter = [500, 7000, 70];
  const startAtAirbase = Math.random() < 0.5;
  const start = startAtAirbase ? airbase : spaceCenter;
  const end = startAtAirbase ? spaceCenter : airbase;
  const player = state.plane.pos;
  const intercept = [player[0], player[1], Math.max(190, player[2] + 70)];
  jet.active = true;
  jet.direction = startAtAirbase ? 1 : -1;
  jet.t = 0;
  jet.route = [start, intercept, end];
  jet.pos = [...start];
  jet.cooldown = 1.2 + Math.random() * 1.4;
  statusEl.textContent = "unidentified fast mover";
}

function fireFighterShot() {
  const jet = state.fighterJet;
  const aim = add(state.plane.pos, scale(state.plane.vel, 0.35));
  const dir = normalize(subtract(aim, jet.pos));
  state.fighterShots.push({
    pos: add(jet.pos, scale(dir, 24)),
    vel: scale(dir, FIGHTER_SHOT_SPEED + Math.random() * 45),
    life: 6.5,
  });
  spawnParticles(jet.pos, [0.62, 0.64, 0.66, 0.68], 5, 18);
}

function updateFighterJet(dt) {
  const jet = state.fighterJet;
  if (!jet.active) {
    jet.next -= dt;
    if (jet.next > 0) return;
    spawnFighterJet();
  }
  jet.t += dt * FIGHTER_ROUTE_SPEED;
  if (jet.t >= 1) {
    jet.active = false;
    jet.route = null;
    scheduleNextFighterJet();
    return;
  }
  const p0 = fighterRoutePoint(jet.route, Math.max(0, jet.t - 0.006));
  const p1 = fighterRoutePoint(jet.route, jet.t);
  const p2 = fighterRoutePoint(jet.route, Math.min(1, jet.t + 0.006));
  const dx = p2[0] - p0[0];
  const dy = p2[1] - p0[1];
  const dz = p2[2] - p0[2];
  jet.pos = p1;
  jet.yaw = Math.atan2(-dx, dy);
  jet.pitch = clamp(Math.atan2(dz, Math.hypot(dx, dy)), -0.28, 0.28);
  jet.roll = clamp(-dx / Math.max(600, Math.hypot(dx, dy)), -0.42, 0.42);

  const attackWindow = FIGHTER_ATTACK_SECONDS * FIGHTER_ROUTE_SPEED * 0.5;
  if (Math.abs(jet.t - 0.5) < attackWindow) {
    jet.cooldown -= dt;
    if (jet.cooldown <= 0) {
      fireFighterShot();
      jet.cooldown = 1.05 + Math.random() * 1.35;
    }
  }
}

function quadraticRoutePoint(points, t, direction = 1) {
  const start = direction > 0 ? points[0] : points[2];
  const mid = points[1];
  const end = direction > 0 ? points[2] : points[0];
  const control = [
    2 * mid[0] - (start[0] + end[0]) * 0.5,
    2 * mid[1] - (start[1] + end[1]) * 0.5,
    2 * mid[2] - (start[2] + end[2]) * 0.5,
  ];
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [
    start[0] * a + control[0] * b + end[0] * c,
    start[1] * a + control[1] * b + end[1] * c,
    start[2] * a + control[2] * b + end[2] * c,
  ];
}

function updateRouteShip(dt, ship, points, speed, pauseMin, pauseRange) {
  if (!ship.active) {
    ship.next -= dt;
    if (ship.next > 0) return;
    ship.active = true;
    ship.direction = Math.random() < 0.5 ? 1 : -1;
    ship.t = 0;
  }
  ship.t += dt * speed;
  if (ship.t >= 1) {
    ship.active = false;
    ship.next = pauseMin + Math.random() * pauseRange;
    return;
  }
  const p0 = quadraticRoutePoint(points, Math.max(0, ship.t - 0.006), ship.direction);
  const p1 = quadraticRoutePoint(points, ship.t, ship.direction);
  const p2 = quadraticRoutePoint(points, Math.min(1, ship.t + 0.006), ship.direction);
  ship.pos = p1;
  ship.yaw = Math.atan2(-(p2[0] - p0[0]), p2[1] - p0[1]);
}

function randomJetSkiPoint() {
  return [
    2220 + Math.random() * 720,
    360 + Math.random() * 1780,
    1.15,
  ];
}

function updateJetSkis(dt) {
  for (const ski of state.jetSkis) {
    const toTarget = subtract(ski.target, ski.pos);
    const distance = Math.hypot(toTarget[0], toTarget[1]);
    if (distance < 45) ski.target = randomJetSkiPoint();
    const desiredYaw = Math.atan2(-(ski.target[0] - ski.pos[0]), ski.target[1] - ski.pos[1]);
    let delta = desiredYaw - ski.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    ski.yaw += clamp(delta, -dt * 2.6, dt * 2.6);
    const speed = ski.speed * (0.78 + 0.22 * Math.sin(state.weatherTime * 3.1 + ski.phase));
    ski.pos[0] += -Math.sin(ski.yaw) * speed * dt;
    ski.pos[1] += Math.cos(ski.yaw) * speed * dt;
    ski.pos[2] = 1.05 + Math.sin(state.weatherTime * 8 + ski.phase) * 0.18;
    if (ski.pos[0] < 2100 || ski.pos[0] > 3040 || ski.pos[1] < 260 || ski.pos[1] > 2240) {
      ski.target = randomJetSkiPoint();
    }
  }
}

function randomGolfCartPoint() {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * LEAF_LINKS_RADIUS;
  return [LEAF_LINKS_CENTER[0] + Math.cos(a) * r, LEAF_LINKS_CENTER[1] + Math.sin(a) * r, 2.0];
}

function updateGolfCarts(dt) {
  for (const cart of state.golfCarts) {
    if (cart.wait > 0) {
      cart.wait -= dt;
      continue;
    }
    const toTarget = subtract(cart.target, cart.pos);
    const distance = Math.hypot(toTarget[0], toTarget[1]);
    if (distance < 7) {
      cart.target = randomGolfCartPoint();
      cart.wait = 1.6 + Math.random() * 4.4;
      continue;
    }
    const desiredYaw = Math.atan2(-(cart.target[0] - cart.pos[0]), cart.target[1] - cart.pos[1]);
    let delta = desiredYaw - cart.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    cart.yaw += clamp(delta, -dt * 1.8, dt * 1.8);
    const speed = cart.speed * clamp(distance / 30, 0.35, 1);
    cart.pos[0] += -Math.sin(cart.yaw) * speed * dt;
    cart.pos[1] += Math.cos(cart.yaw) * speed * dt;
    const fromCenter = Math.hypot(cart.pos[0] - LEAF_LINKS_CENTER[0], cart.pos[1] - LEAF_LINKS_CENTER[1]);
    if (fromCenter > LEAF_LINKS_RADIUS + 12) cart.target = randomGolfCartPoint();
  }
}

function keysSeaplanePoint(t, direction) {
  const west = [-6500, -7850, 4];
  const east = [-2200, -6280, 4];
  const a = direction > 0 ? west : east;
  const b = direction > 0 ? east : west;
  const cruise = Math.sin(Math.PI * t);
  const wiggle = Math.sin(t * Math.PI * 2.4) * 70;
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t) + wiggle,
    5 + cruise * 88,
  ];
}

function updateKeysSeaplane(dt) {
  const plane = state.keysSeaplane;
  if (!plane.active) {
    plane.next -= dt;
    if (plane.next > 0) return;
    plane.active = true;
    plane.direction = Math.random() < 0.5 ? 1 : -1;
    plane.t = 0;
  }
  plane.t += dt * 0.018;
  if (plane.t >= 1) {
    plane.active = false;
    plane.next = 80 + Math.random() * 110;
    return;
  }
  const p0 = keysSeaplanePoint(Math.max(0, plane.t - 0.01), plane.direction);
  const p1 = keysSeaplanePoint(plane.t, plane.direction);
  const p2 = keysSeaplanePoint(Math.min(1, plane.t + 0.01), plane.direction);
  const dx = p2[0] - p0[0];
  const dy = p2[1] - p0[1];
  const dz = p2[2] - p0[2];
  plane.pos = p1;
  plane.yaw = Math.atan2(-dx, dy);
  plane.pitch = clamp(Math.atan2(dz, Math.hypot(dx, dy)), -0.18, 0.18);
  plane.roll = Math.sin(plane.t * Math.PI * 2) * 0.08;
}

function balancedTextLines(text, targetLength = 62) {
  if (text.length <= targetLength) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lineCount = clamp(Math.ceil(text.length / targetLength), 2, 4);
  const lengths = words.map((word) => word.length);
  const prefix = [0];
  for (const length of lengths) prefix.push(prefix[prefix.length - 1] + length);
  const lineLength = (start, end) => prefix[end] - prefix[start] + end - start - 1;
  const target = text.length / lineCount;
  const costs = Array.from({ length: lineCount + 1 }, () => Array(words.length + 1).fill(Infinity));
  const splits = Array.from({ length: lineCount + 1 }, () => Array(words.length + 1).fill(0));
  costs[0][0] = 0;
  for (let line = 1; line <= lineCount; line++) {
    for (let end = line; end <= words.length; end++) {
      for (let start = line - 1; start < end; start++) {
        const length = lineLength(start, end);
        const cost = costs[line - 1][start] + (length - target) ** 2;
        if (cost < costs[line][end]) {
          costs[line][end] = cost;
          splits[line][end] = start;
        }
      }
    }
  }
  const lines = [];
  let end = words.length;
  for (let line = lineCount; line > 0; line--) {
    const start = splits[line][end];
    lines.unshift(words.slice(start, end).join(" "));
    end = start;
  }
  return lines;
}

function setRadioText(text) {
  const lines = balancedTextLines(text);
  radioEl.replaceChildren();
  lines.forEach((line, index) => {
    if (index) radioEl.appendChild(document.createElement("br"));
    radioEl.appendChild(document.createTextNode(line));
  });
}

function updateRadio(dt) {
  state.radioTime += dt;
  if (state.radioTime > state.radioNext) {
    if (!state.radioQueue.length) state.radioQueue = shuffle([...RADIO_LINES]);
    setRadioText(state.radioQueue.pop());
    radioEl.classList.add("visible");
    state.radioIndex += 1;
    state.radioUntil = state.radioTime + 4.2;
    state.radioNext = state.radioUntil + 8 + Math.random() * 7;
  }
  if (state.radioTime > state.radioUntil) radioEl.classList.remove("visible");
}

function nonInteractiveEventParts() {
  return NON_INTERACTIVE_EVENTS.map((event) => {
    const match = event.match(/^(-?\d+)\s+(\S+)\s+-\s+(.+)$/);
    if (!match) return null;
    return {
      number: match[1],
      acronym: match[2],
      words: match[3].split(/\s+/).filter((word) => word && word !== "-"),
    };
  }).filter(Boolean);
}

const NON_INTERACTIVE_EVENT_PARTS = nonInteractiveEventParts();
const NON_INTERACTIVE_EVENT_ACRONYMS = [
  ...NON_INTERACTIVE_EVENT_PARTS.map((event) => event.acronym),
  "NIECCCP",
  "NIEPTSD",
  "NIEADHD",
  "NIEVVIP",
  "NIEBSOD",
  "NIEMALS",
];

function formatNonInteractiveEvent() {
  const maxLength = 50;
  const number = pick(NON_INTERACTIVE_EVENT_PARTS).number;
  const acronym = pick(NON_INTERACTIVE_EVENT_ACRONYMS);
  const words = NON_INTERACTIVE_EVENT_PARTS.flatMap((event) => event.words);
  let text = `${number} ${acronym} -`;
  const used = new Set();
  const firstWord = pick(words);
  used.add(firstWord);
  text += ` ${firstWord}`;
  for (let i = 0; i < 24; i++) {
    if (text.length >= maxLength - 2) break;
    const next = pick(words);
    if (used.has(next)) continue;
    const candidate = `${text} ${next}`;
    if (candidate.length > maxLength) {
      text = `${candidate.slice(0, maxLength - 1)}…`;
      break;
    }
    used.add(next);
    text = candidate;
  }
  return text.toUpperCase();
}

function updateNonInteractiveEvent() {
  if (state.weatherTime < state.eventUntil) return;
  if (state.eventMode === "metar") {
    state.eventMode = "event";
    metarEl.classList.add("event");
    metarEl.title = "NON-INTERACTIVE EVENT - DO NOT CLICK!";
    metarEl.textContent = formatNonInteractiveEvent();
    state.eventUntil = state.weatherTime + 10 + Math.random() * 10;
  } else {
    state.eventMode = "metar";
    metarEl.classList.remove("event");
    metarEl.removeAttribute("title");
    metarEl.textContent = METAR_TEXT;
    state.eventUntil = state.weatherTime + 5;
  }
}

function debugValue(min, max, digits = 2) {
  return (min + Math.random() * (max - min)).toFixed(digits);
}

function makeDebugLine(template) {
  return template
    .replaceAll("{idle}", debugValue(0.02, 0.98, 3))
    .replaceAll("{lc}", debugValue(4.5, 84.5, 1))
    .replaceAll("{slot}", String(1 + Math.floor(Math.random() * 12)).padStart(2, "0"))
    .replaceAll("{speed}", debugValue(0, 7.5, 2))
    .replaceAll("{pool}", String(22 + Math.floor(Math.random() * 54)))
    .replaceAll("{poolMax}", String(80 + Math.floor(Math.random() * 80)))
    .replaceAll("{upper}", debugValue(0, 1, 3))
    .replaceAll("{upperMax}", debugValue(0.4, 0.98, 3))
    .replaceAll("{motion}", debugValue(0.02, 0.99, 3));
}

function triggerDebugOverlay() {
  const count = 16 + Math.floor(Math.random() * 7);
  state.debugLines = shuffle([...DEBUG_TEMPLATES])
    .slice(0, count)
    .map((template, index) => ({
      text: makeDebugLine(template),
      color: index < 2 ? DEBUG_COLORS[0] : pick(DEBUG_COLORS),
      band: Math.random() < 0.72,
    }));
  const longest = Math.max(...state.debugLines.map((line) => line.text.length));
  state.debugStarted = state.weatherTime;
  state.debugHoldAt = state.debugStarted + count * 0.07 + longest * 0.014;
  state.debugUntil = state.debugHoldAt + 2.4;
}

function updateDebugOverlay() {
  if (state.weatherTime < state.debugNext) return;
  if (Math.random() < 0.45) triggerDebugOverlay();
  state.debugNext = state.weatherTime + 50 + Math.random() * 35;
}

function updateBlockedPopup() {
  if (state.weatherTime < state.blockedPopupNext) return;
  state.blockedPopupCount = 25 + Math.floor(Math.random() * 61);
  state.blockedPopupUntil = state.weatherTime + 5;
  state.blockedPopupNext = state.weatherTime + 240 + Math.random() * 120;
}

function updateScreenshotFlyThroughs() {
  for (const camera of state.cameras) {
    if (state.screenshotHits.has(camera.name) || !camera.xyz || !camera.ypr || !camera.fov || camera.name?.endsWith(" Fake Cam")) continue;
    const hf = Math.tan((camera.fov[0] || 50) * Math.PI / 360);
    const vf = Math.tan((camera.fov[1] || 35) * Math.PI / 360);
    const forward = directionFromYpr(camera.ypr, 0, 0);
    const center = add(camera.xyz, scale(forward, CAMERA_THUMBNAIL_DISTANCE));
    const rightEdge = add(camera.xyz, scale(directionFromYpr(camera.ypr, hf, 0), CAMERA_THUMBNAIL_DISTANCE));
    const topEdge = add(camera.xyz, scale(directionFromYpr(camera.ypr, 0, vf), CAMERA_THUMBNAIL_DISTANCE));
    const right = normalize(subtract(rightEdge, center));
    const up = normalize(subtract(topEdge, center));
    const rel = subtract(state.plane.pos, center);
    const planeDistance = Math.abs(dot(rel, forward));
    const horizontal = Math.abs(dot(rel, right));
    const vertical = Math.abs(dot(rel, up));
    if (planeDistance < 16 && horizontal < length(subtract(rightEdge, center)) && vertical < length(subtract(topEdge, center))) {
      state.screenshotHits.add(camera.name);
      state.score += 1;
      statusEl.textContent = `screenshot fly-through: ${camera.name}`;
      spawnParticles(state.plane.pos, [1, 1, 0.72, 1], 16, 20);
    }
  }
}

function update(dt, now) {
  if (state.deadZoneResetAt && state.weatherTime >= state.deadZoneResetAt) resetPlane();
  state.stickFlash = Math.max(0, state.stickFlash - dt * 5.5);
  updatePlane(dt, now);
  updateAirliner(dt);
  updateAmbientActors(dt);
  updateRadio(dt);
  updateNonInteractiveEvent();
  updateDetailTiles();
  updateScreenshotFlyThroughs();
  updateBullets(dt);
  updateFighterShots(dt);
  updatePrisonDefense(dt);
  updateParticles(dt);
  updateDebugOverlay();
  updateBlockedPopup();
  updateCamera(dt);
  updateRadioVolume();
  updatePhoneVolume();
  updatePhoneButtonVisibility();
  speedEl.textContent = `SPD ${length(state.plane.vel).toFixed(0)}`;
  latitudeEl.textContent = `LAT ${Math.round(state.plane.pos[1])}`;
  longitudeEl.textContent = `LNG ${Math.round(state.plane.pos[0])}`;
  altitudeEl.textContent = `ALT ${state.plane.pos[2].toFixed(0)}`;
  yawEl.textContent = `YAW ${Math.round((state.plane.yaw * 180 / Math.PI % 360 + 360) % 360)}`;
  scoreEl.textContent = `SCORE ${state.score}`;
  modeEl.textContent = state.storm ? "STORM MODE" : "SUNNY CHAOS";
  weatherButton.textContent = state.storm ? "clear" : "storm";
  dayNightButton.textContent = state.night ? "day" : "night";
  const controllerText = state.gamepad.connected ? " / controller" : " / plug in your controller!";
  const tileCount = state.tiles.filter((tile) => tile?.loaded).length;
  const landmarkCount = state.landmarkModels.filter((model) => model.texture?.loaded).length;
  tilesEl.textContent = `${tileCount} tiles / ${landmarkCount} landmarks${controllerText}`;
  if (state.gamepad.connected && statusEl.textContent === "fresh floatplane, highly legal") {
    statusEl.textContent = "controller: left stick fly, right stick look, L1/R1 throttle, X shoots, □/○/△ missiles";
  }
}

function matrix() {
  return mat4Multiply(
    perspective(58 * Math.PI / 180, state.width / state.height, 0.8, 95000),
    lookAt(worldToGl(...state.camera.eye), worldToGl(...state.camera.target), [0, 1, 0]),
  );
}

function modelPoint(local, basis, origin = state.plane.pos) {
  return add(add(add(origin, scale(basis.right, local[0])), scale(basis.forward, local[1])), scale(basis.up, local[2]));
}

function pushTri(mesh, a, b, c) {
  mesh.push(a, b, c);
}

function pushQuad(mesh, a, b, c, d) {
  pushTri(mesh, a, b, c);
  pushTri(mesh, a, c, d);
}

function pushBox(mesh, min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  pushQuad(mesh, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
  pushQuad(mesh, [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]);
  pushQuad(mesh, [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]);
  pushQuad(mesh, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(mesh, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]);
  pushQuad(mesh, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
}

function pushEllipsoid(mesh, center, radii, rings = 7, segments = 14) {
  const [cx, cy, cz] = center;
  const [rx, ry, rz] = radii;
  const points = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings * Math.PI;
    const y = Math.cos(v) * ry;
    const ringRadius = Math.sin(v);
    const ring = [];
    for (let s = 0; s < segments; s++) {
      const a = s / segments * Math.PI * 2;
      ring.push([cx + Math.cos(a) * rx * ringRadius, cy + y, cz + Math.sin(a) * rz * ringRadius]);
    }
    points.push(ring);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      pushQuad(mesh, points[r][s], points[r][next], points[r + 1][next], points[r + 1][s]);
    }
  }
}

function meshVertices(mesh, basis, origin) {
  return mesh.flatMap((p) => worldToGl(...modelPoint(p, basis, origin)));
}

function drawPlane(m) {
  const b = planeBasis();
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b)));
  drawColor(tri([-3.8, 14, -0.8], [3.8, 14, -0.8], [0, -17, 1.2]), [1, 0.96, 0.84, 1], m);
  drawColor(tri([-3.4, 14.4, -0.55], [3.4, 14.4, -0.55], [0, 18, 0.25]), [1, 0.8, 0.16, 1], m);
  drawColor(tri([-48, 0, 2.5], [48, 0, 2.5], [6, 5.6, 3.2], [-48, 0, 2.5], [6, 5.6, 3.2], [-6, 5.6, 3.2]), [1, 0.97, 0.88, 1], m);
  drawColor(tri([-30, 0.4, 2.65], [-10, 0.4, 2.65], [-10, 5.5, 3.28], [10, 0.4, 2.65], [30, 0.4, 2.65], [10, 5.5, 3.28]), [1, 0.77, 0.1, 1], m);
  drawColor(tri([-10, -11, -0.6], [10, -11, -0.6], [0, -25, 0.25]), [1, 0.97, 0.86, 1], m);
  drawColor(tri([-7, -18.2, 0.2], [7, -18.2, 0.2], [0, -24.5, 1.1]), [1, 0.8, 0.16, 1], m);
  drawColor(tri([0, -16, 0], [0, -24, 9.6], [0, -18.5, 1.1]), [1, 0.84, 0.18, 1], m);
  drawColor(tri([-7, 14, -5.5], [-3, 14, -5.5], [-5, -13, -5.5], [3, 14, -5.5], [7, 14, -5.5], [5, -13, -5.5]), [0.44, 0.37, 0.24, 1], m);
  drawColor(tri([-6.7, 12, -5.1], [-3.3, 12, -5.1], [-5, 18, -4.8], [3.3, 12, -5.1], [6.7, 12, -5.1], [5, 18, -4.8]), [0.18, 0.16, 0.13, 1], m);
  const prop = [];
  const center = modelPoint([0, 17.2, 0.1], b);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8 + performance.now() * 0.04;
    const p1 = add(center, add(scale(b.right, Math.cos(a) * 6), scale(b.up, Math.sin(a) * 6)));
    const p2 = add(center, add(scale(b.right, Math.cos(a + Math.PI) * 6), scale(b.up, Math.sin(a + Math.PI) * 6)));
    prop.push(...worldToGl(...p1), ...worldToGl(...p2));
  }
  drawColor(prop, [0.05, 0.06, 0.07, 0.45], m, gl.LINES);
}

function drawKeysSeaplane(m) {
  const plane = state.keysSeaplane;
  if (!plane.active) return;
  const b = actorBasis(plane);
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, plane.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, plane.pos)));
  const fuselage = [];
  pushEllipsoid(fuselage, [0, 1, 0], [4.4, 22, 5.2], 6, 12);
  drawColor(meshVertices(fuselage, b, plane.pos), [0.98, 0.95, 0.84, 1], m);
  const nose = [];
  pushEllipsoid(nose, [0, 21, -0.4], [4.9, 6.5, 4.8], 5, 12);
  drawColor(meshVertices(nose, b, plane.pos), [0.96, 0.74, 0.12, 1], m);
  drawColor(tri([-4.2, 16, 1.6], [4.2, 16, 1.6], [0, 25, 1.2]), [0.04, 0.05, 0.055, 1], m);
  const wings = [];
  pushBox(wings, [-40, -4, 4.8], [40, 6, 6.3]);
  pushBox(wings, [-17, -19, 2.6], [17, -13, 4.0]);
  drawColor(meshVertices(wings, b, plane.pos), [1, 0.97, 0.87, 1], m);
  drawColor(tri([-30, -4.2, 6.4], [-12, -4.2, 6.4], [-12, 5.8, 6.4], [-30, -4.2, 6.4], [-12, 5.8, 6.4], [-30, 5.8, 6.4], [12, -4.2, 6.4], [30, -4.2, 6.4], [30, 5.8, 6.4], [12, -4.2, 6.4], [30, 5.8, 6.4], [12, 5.8, 6.4]), [0.96, 0.74, 0.12, 1], m);
  const floats = [];
  pushBox(floats, [-8.8, -18, -7.5], [-4.2, 18, -4.4]);
  pushBox(floats, [4.2, -18, -7.5], [8.8, 18, -4.4]);
  drawColor(meshVertices(floats, b, plane.pos), [0.35, 0.31, 0.22, 1], m);
  drawColor(tri([0, -17, 0], [0, -30, 12], [0, -19, 1.6]), [0.96, 0.74, 0.12, 1], m);
  drawColor(line([-8, 9, -4.4], [-16, 2, 4.8], [8, 9, -4.4], [16, 2, 4.8], [-8, -10, -4.4], [-13, -5, 3.0], [8, -10, -4.4], [13, -5, 3.0]), [0.08, 0.08, 0.075, 0.95], m, gl.LINES);
  const prop = [];
  const center = modelPoint([0, 27, -0.5], b, plane.pos);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 + performance.now() * 0.026;
    const p1 = add(center, add(scale(b.right, Math.cos(a) * 6), scale(b.up, Math.sin(a) * 6)));
    const p2 = add(center, add(scale(b.right, Math.cos(a + Math.PI) * 6), scale(b.up, Math.sin(a + Math.PI) * 6)));
    prop.push(...worldToGl(...p1), ...worldToGl(...p2));
  }
  drawColor(prop, [0.03, 0.035, 0.04, 0.45], m, gl.LINES);
}

function drawFighterJet(m) {
  const jet = state.fighterJet;
  if (!jet.active) return;
  const b = actorBasis(jet);
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, jet.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, jet.pos)));
  const body = [];
  pushEllipsoid(body, [0, 0, 0], [5.8, 25, 4.7], 6, 12);
  drawColor(meshVertices(body, b, jet.pos), [0.16, 0.18, 0.19, 1], m);
  drawColor(tri([-4.4, 19, -1.2], [4.4, 19, -1.2], [0, 34, 0.2], [-4.0, 12, 2.8], [4.0, 12, 2.8], [0, 24, 4.1]), [0.09, 0.1, 0.11, 1], m);
  drawColor(tri([-7, -5, 0], [-50, -18, 0.5], [-9, 8, 1.3], [7, -5, 0], [50, -18, 0.5], [9, 8, 1.3]), [0.2, 0.22, 0.23, 1], m);
  drawColor(tri([-4.5, -18, 0.2], [-25, -33, 0.8], [-5, -9, 1.1], [4.5, -18, 0.2], [25, -33, 0.8], [5, -9, 1.1]), [0.17, 0.19, 0.2, 1], m);
  drawColor(tri([0, -18, 0], [0, -34, 13], [0, -23, 1.4]), [0.13, 0.15, 0.16, 1], m);
  drawColor(tri([-2.4, 18.5, 3.4], [2.4, 18.5, 3.4], [0, 9, 4.9]), [0.03, 0.04, 0.05, 1], m);
  drawColor(tri([0, -31, 10.5], [0, -25, 8.1], [0, -28, 13.2], [-2.2, -26, 7.8], [-8.8, -35, 7.6], [-2.4, -31, 11.2], [2.2, -26, 7.8], [8.8, -35, 7.6], [2.4, -31, 11.2]), [0.88, 0.68, 0.08, 1], m);
  drawColor(line([-4.8, -25, -1.6], [-10, -34, -2.2], [4.8, -25, -1.6], [10, -34, -2.2], [-50, -18, 0.5], [-62, -28, 0.2], [50, -18, 0.5], [62, -28, 0.2]), [0.46, 0.48, 0.5, 0.6], m, gl.LINES);
}

function drawAirliner(m) {
  const jet = state.airliner;
  const b = actorBasis(jet);
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, jet.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, jet.pos)));
  const twoSided = (color, ...points) => drawColor(tri(...points, ...[...points].reverse()), color, m);
  const fuselage = [];
  pushEllipsoid(fuselage, [0, -4, 0], [10, 96, 8.5], 8, 16);
  drawColor(meshVertices(fuselage, b, jet.pos), [0.96, 0.94, 0.86, 1], m);
  const belly = [];
  pushEllipsoid(belly, [0, -18, -2.8], [7.5, 62, 4.2], 5, 12);
  drawColor(meshVertices(belly, b, jet.pos), [0.78, 0.76, 0.68, 1], m);
  drawColor(tri([-7, 84, -1.5], [7, 84, -1.5], [0, 104, -0.5]), [0.92, 0.91, 0.84, 1], m);
  const wings = [];
  pushBox(wings, [-88, -20, -1.6], [-8, 18, 1.4]);
  pushBox(wings, [8, -20, -1.6], [88, 18, 1.4]);
  drawColor(meshVertices(wings, b, jet.pos), [0.86, 0.83, 0.73, 1], m);
  twoSided([0.86, 0.83, 0.73, 1], [-88, 18, 0], [-88, -20, 0], [-104, -8, 1.2], [88, 18, 0], [104, -8, 1.2], [88, -20, 0]);
  const tailplane = [];
  pushBox(tailplane, [-36, -96, 0], [-4, -78, 3.2]);
  pushBox(tailplane, [4, -96, 0], [36, -78, 3.2]);
  drawColor(meshVertices(tailplane, b, jet.pos), [0.86, 0.84, 0.76, 1], m);
  twoSided([0.08, 0.12, 0.2, 1], [-4, -84, 3], [4, -84, 3], [0, -111, 39], [-4, -94, 4], [4, -94, 4], [0, -111, 39]);
  drawColor(tri([-8, 78, -4], [8, 78, -4], [0, 90, -5.6]), [0.72, 0.12, 0.08, 1], m);
  for (const engine of [[-51, 2, -6], [51, 2, -6], [-26, 4, -6], [26, 4, -6]]) {
    const pod = [];
    pushEllipsoid(pod, engine, [5.8, 9.5, 5.2], 5, 12);
    drawColor(meshVertices(pod, b, jet.pos), [0.18, 0.17, 0.15, 1], m);
  }
  drawColor(line([-9, 82, 0], [9, 82, 0], [9, 82, 0], [0, -92, 2.5], [0, -92, 2.5], [-9, 82, 0], [-88, 8, 0], [88, 8, 0], [-36, -80, 1], [36, -80, 1], [0, -84, 1], [0, -112, 38], [-5, 72, 1.8], [5, 72, 1.8], [-5, 52, 2.1], [5, 52, 2.1], [-5, 32, 2.3], [5, 32, 2.3], [-5, 12, 2.4], [5, 12, 2.4]), [0.16, 0.18, 0.2, 0.72], m, gl.LINES);
}

function drawBlimp(m) {
  const b = actorBasis({ yaw: state.blimp.yaw, pitch: 0, roll: 0 });
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, state.blimp.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, state.blimp.pos)));
  const twoSided = (color, ...points) => drawColor(tri(...points, ...[...points].reverse()), color, m);
  const envelope = [];
  pushEllipsoid(envelope, [0, 0, 0], [54, 84, 27], 9, 18);
  drawColor(meshVertices(envelope, b, state.blimp.pos), [0.92, 0.95, 0.93, 0.96], m);
  drawColor(tri([0, -84, 0], [0, -112, 10], [0, -112, -10], [-14, -79, 0], [-42, -104, 8], [-42, -104, -8], [14, -79, 0], [42, -104, 8], [42, -104, -8]), [0.74, 0.8, 0.78, 1], m);
  twoSided([0.72, 0.78, 0.76, 1], [0, -62, 22], [0, -104, 45], [0, -86, 12]);
  twoSided([0.72, 0.78, 0.76, 1], [0, -62, -22], [0, -104, -45], [0, -86, -12]);
  twoSided([0.72, 0.78, 0.76, 1], [-42, -58, 0], [-72, -96, 0], [-28, -82, 8]);
  twoSided([0.72, 0.78, 0.76, 1], [42, -58, 0], [72, -96, 0], [28, -82, 8]);
  drawColor(line([-54, 0, 0], [54, 0, 0], [0, 84, 27], [0, -84, 27], [0, 84, -27], [0, -84, -27], [0, -84, 0], [0, -112, 10], [0, -84, 0], [0, -112, -10], [-14, -79, 0], [-42, -104, 8], [14, -79, 0], [42, -104, 8]), [0.55, 0.62, 0.64, 0.72], m, gl.LINES);
}

function drawChopper(m) {
  const actor = { yaw: state.chopper.yaw, pitch: 0, roll: Math.sin(state.chopper.t * 1.3) * 0.06 };
  const b = actorBasis(actor);
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, state.chopper.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, state.chopper.pos)));
  const body = [];
  pushBox(body, [-10, -18, -5], [10, 18, 8]);
  pushBox(body, [-7, 14, -3], [7, 29, 6]);
  drawColor(meshVertices(body, b, state.chopper.pos), [0.78, 0.08, 0.07, 1], m);
  const cabin = [];
  pushBox(cabin, [-7, 12, 0], [7, 27, 8]);
  drawColor(meshVertices(cabin, b, state.chopper.pos), [0.04, 0.05, 0.06, 1], m);
  const tail = [];
  pushBox(tail, [-2.2, -60, 4], [2.2, -18, 8]);
  drawColor(meshVertices(tail, b, state.chopper.pos), [0.42, 0.05, 0.05, 1], m);
  drawColor(tri([0, -55, 8], [0, -70, 22], [0, -60, 7], [-2, -58, 7], [-18, -69, 8], [-2, -62, 11], [2, -58, 7], [18, -69, 8], [2, -62, 11]), [0.08, 0.08, 0.07, 1], m);
  drawColor(line([-16, 3, -10], [16, 3, -10], [-16, -20, -10], [16, -20, -10], [-13, 2, -10], [-13, 2, -3], [13, 2, -10], [13, 2, -3], [-13, -19, -10], [-13, -19, -3], [13, -19, -10], [13, -19, -3]), [0.07, 0.07, 0.06, 1], m, gl.LINES);
  const rotor = [];
  const center = modelPoint([0, 4, 14], b, state.chopper.pos);
  const spin = performance.now() * 0.018;
  for (let i = 0; i < 4; i++) {
    const a = spin + i * Math.PI / 2;
    const p1 = add(center, add(scale(b.right, Math.cos(a) * 42), scale(b.forward, Math.sin(a) * 42)));
    const p2 = add(center, add(scale(b.right, -Math.cos(a) * 42), scale(b.forward, -Math.sin(a) * 42)));
    rotor.push(...worldToGl(...p1), ...worldToGl(...p2));
  }
  drawColor(rotor, [0.08, 0.08, 0.08, 0.55], m, gl.LINES);
}

function drawBoats(m) {
  for (const boat of state.boats) {
    const b = actorBasis({ yaw: boat.yaw, pitch: 0, roll: 0 });
    const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, boat.pos)));
    const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, boat.pos)));
    drawColor(tri([-8, 12, 0], [8, 12, 0], [0, -16, 0], [-5, 8, 2.5], [5, 8, 2.5], [0, -6, 4]), [0.96, 0.97, 0.92, 1], m);
    drawColor(line([-5, -18, 0], [-18, -32, 0], [5, -18, 0], [18, -32, 0]), [0.86, 0.94, 1, 0.45], m, gl.LINES);
  }
  for (const ski of state.jetSkis) {
    const b = actorBasis({ yaw: ski.yaw, pitch: 0, roll: Math.sin(state.weatherTime * 5 + ski.phase) * 0.08 });
    const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ski.pos)));
    const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ski.pos)));
    drawColor(tri([-2.2, 4.4, 0], [2.2, 4.4, 0], [0, -6.2, 0.8], [-1.45, 1.6, 1.0], [1.45, 1.6, 1.0], [0, -2.7, 2.1]), ski.color, m);
    drawColor(tri([-1.5, 3.4, 0.8], [1.5, 3.4, 0.8], [0, 5.5, 1.25]), [0.08, 0.1, 0.12, 1], m);
    drawColor(line([-1.6, -6.5, 0], [-8, -22, 0], [1.6, -6.5, 0], [8, -22, 0]), [0.8, 0.95, 1, 0.55], m, gl.LINES);
  }
}

function drawCruiseShip(m) {
  const ship = state.cruiseShip;
  if (!ship.active) return;
  const b = actorBasis({ yaw: ship.yaw, pitch: 0, roll: Math.sin(state.weatherTime * 0.7) * 0.015 });
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ship.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ship.pos)));
  const hull = [];
  pushBox(hull, [-32, -76, 0], [32, 70, 13]);
  drawColor(meshVertices(hull, b, ship.pos), [0.9, 0.93, 0.94, 1], m);
  drawColor(tri([-32, 70, 0], [32, 70, 0], [0, 95, 7], [-32, -76, 0], [0, -94, 6], [32, -76, 0]), [0.78, 0.82, 0.86, 1], m);
  const decks = [];
  pushBox(decks, [-25, -54, 13], [25, 48, 24]);
  pushBox(decks, [-19, -34, 24], [19, 35, 34]);
  pushBox(decks, [-11, -14, 34], [11, 22, 44]);
  drawColor(meshVertices(decks, b, ship.pos), [0.98, 0.98, 0.94, 1], m);
  drawColor(tri([-24, 54, 24], [24, 54, 24], [0, 70, 29]), [0.78, 0.82, 0.86, 1], m);
  drawColor(line([-35, -90, 1], [-68, -126, 1], [35, -90, 1], [68, -126, 1], [-28, -70, 1], [-58, -104, 1], [28, -70, 1], [58, -104, 1]), [0.82, 0.94, 1, 0.42], m, gl.LINES);
}

function drawContainerShip(m) {
  const ship = state.containerShip;
  if (!ship.active) return;
  const b = actorBasis({ yaw: ship.yaw, pitch: 0, roll: Math.sin(state.weatherTime * 0.55) * 0.012 });
  const tri = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ship.pos)));
  const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, ship.pos)));
  const hull = [];
  pushBox(hull, [-34, -86, 0], [34, 86, 18]);
  drawColor(meshVertices(hull, b, ship.pos), [0.03, 0.22, 0.14, 1], m);
  drawColor(tri([-34, 86, 0], [34, 86, 0], [0, 112, 10], [-34, -86, 0], [0, -108, 8], [34, -86, 0]), [0.02, 0.16, 0.11, 1], m);
  const deck = [];
  pushBox(deck, [-28, -70, 18], [28, 36, 22]);
  pushBox(deck, [-26, 44, 18], [26, 78, 42]);
  drawColor(meshVertices(deck, b, ship.pos), [0.36, 0.12, 0.12, 1], m);
  const colors = [[0.72, 0.18, 0.12, 1], [0.86, 0.65, 0.24, 1], [0.18, 0.35, 0.62, 1], [0.74, 0.72, 0.62, 1], [0.45, 0.2, 0.14, 1]];
  let colorIndex = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const box = [];
      const x = -25 + col * 12;
      const y = -60 + row * 24;
      const z = 22 + (col % 2) * 5;
      pushBox(box, [x, y, z], [x + 10, y + 18, z + 8]);
      drawColor(meshVertices(box, b, ship.pos), colors[colorIndex++ % colors.length], m);
    }
  }
  drawColor(line([-36, -104, 1], [-72, -144, 1], [36, -104, 1], [72, -144, 1], [-34, -84, 1], [-64, -120, 1], [34, -84, 1], [64, -120, 1]), [0.82, 0.94, 1, 0.38], m, gl.LINES);
}

function drawGolfCarts(m) {
  for (const cart of state.golfCarts) {
    const b = actorBasis({ yaw: cart.yaw, pitch: 0, roll: 0 });
    const body = [];
    pushBox(body, [-3.2, -4.8, 0], [3.2, 4.8, 3.1]);
    pushBox(body, [-2.6, -2.6, 3.1], [2.6, 2.8, 5.8]);
    drawColor(meshVertices(body, b, cart.pos), [0.96, 0.96, 0.9, 1], m);
    const dark = [];
    pushBox(dark, [-2.1, -1.4, 3.2], [2.1, 2.2, 5.4]);
    drawColor(meshVertices(dark, b, cart.pos), [0.08, 0.1, 0.09, 1], m);
    const line = (...points) => points.flatMap((p) => worldToGl(...modelPoint(p, b, cart.pos)));
    drawColor(line([-3.4, -4.8, 0], [-4.8, -4.8, 0], [3.4, -4.8, 0], [4.8, -4.8, 0], [-3.4, 4.8, 0], [-4.8, 4.8, 0], [3.4, 4.8, 0], [4.8, 4.8, 0]), [0.04, 0.04, 0.035, 1], m, gl.LINES);
  }
}

function billboardQuad(pos, size, cameraRight, cameraUp) {
  const r = scale(cameraRight, size);
  const u = scale(cameraUp, size);
  const p0 = subtract(subtract(pos, r), u);
  const p1 = add(subtract(pos, u), r);
  const p2 = add(add(pos, r), u);
  const p3 = add(subtract(pos, r), u);
  return [
    ...worldToGl(...p0), 0, 0,
    ...worldToGl(...p1), 1, 0,
    ...worldToGl(...p2), 1, 1,
    ...worldToGl(...p0), 0, 0,
    ...worldToGl(...p2), 1, 1,
    ...worldToGl(...p3), 0, 1,
  ];
}

function cameraBillboardBasis() {
  const eye = worldToGl(...state.camera.eye);
  const target = worldToGl(...state.camera.target);
  const forward = normalize(subtract(target, eye));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = normalize(cross(right, forward));
  return { right: glToWorld(right), up: glToWorld(up) };
}

function drawSprites(m) {
  const { right, up } = cameraBillboardBasis();
  const eye = state.camera.eye;
  if (state.fogEnabled) {
    const fog = [...state.fog].sort((a, b) => {
      const da = Math.hypot(a.pos[0] - eye[0], a.pos[1] - eye[1], a.pos[2] - eye[2]);
      const db = Math.hypot(b.pos[0] - eye[0], b.pos[1] - eye[1], b.pos[2] - eye[2]);
      return db - da;
    });
    for (const patch of fog) {
      const distance = Math.hypot(patch.pos[0] - state.plane.pos[0], patch.pos[1] - state.plane.pos[1], patch.pos[2] - state.plane.pos[2]);
      const alpha = patch.alpha * clamp(1 - distance / 1200, 0, 1);
      if (alpha <= 0.005) continue;
      drawTextured(billboardQuad(patch.pos, patch.size, right, up), fogTexture.texture, m, alpha);
    }
  }
  for (const target of state.targets) {
    if (target.dead) continue;
    const p = worldToGl(...target.pos);
    const r = target.radius;
    drawColor([
      p[0] - r, p[1], p[2],
      p[0] + r, p[1], p[2],
      p[0], p[1] - r, p[2],
      p[0], p[1] + r, p[2],
    ], [0.4, 1, 0.7, 0.85], m, gl.LINES);
  }
  for (const particle of state.particles) {
    drawColor(billboardQuad(particle.pos, particle.size, right, up).filter((_, i) => i % 5 < 3), particle.color, m);
  }
}

function drawBullets(m) {
  const lines = [];
  const missileLines = [];
  const prisonLines = [];
  const fighterLines = [];
  const iconMissiles = [];
  const { right, up } = cameraBillboardBasis();
  for (const bullet of state.bullets) {
    const tail = subtract(bullet.pos, scale(normalize(bullet.vel), bullet.type === "missile" ? 36 : 18));
    if (bullet.type === "missile" || bullet.type === "icon-missile") missileLines.push(...worldToGl(...tail), ...worldToGl(...bullet.pos));
    else lines.push(...worldToGl(...tail), ...worldToGl(...bullet.pos));
    if (bullet.type === "icon-missile") iconMissiles.push(...billboardQuad(bullet.pos, 12, right, up));
  }
  for (const shot of state.prisonShots) {
    const tail = subtract(shot.pos, scale(normalize(shot.vel), 26));
    prisonLines.push(...worldToGl(...tail), ...worldToGl(...shot.pos));
  }
  for (const shot of state.fighterShots) {
    const tail = subtract(shot.pos, scale(normalize(shot.vel), 30));
    fighterLines.push(...worldToGl(...tail), ...worldToGl(...shot.pos));
  }
  drawColor(lines, [1, 0.9, 0.32, 1], m, gl.LINES);
  drawColor(missileLines, [1, 0.28, 0.08, 1], m, gl.LINES);
  drawColor(thickenLines(prisonLines, [0, 0.1, -0.1]), [0.04, 0.12, 0.46, 0.92], m, gl.LINES);
  drawColor(thickenLines(fighterLines, [0, 0.12, -0.12]), [0.54, 0.56, 0.58, 0.95], m, gl.LINES);
  if (state.iconTexture?.loaded && iconMissiles.length) {
    drawTextured(iconMissiles, state.iconTexture.texture, m, 1);
  }
}

function drawBirds(m) {
  const lines = [];
  for (const bird of state.birds) {
    const direction = normalize(bird.vel);
    const side = normalize(cross(direction, [0, 0, 1]));
    const flap = Math.sin(bird.phase) * bird.size * 0.45;
    const left = add(add(bird.pos, scale(side, -bird.size)), [0, 0, flap]);
    const right = add(add(bird.pos, scale(side, bird.size)), [0, 0, flap]);
    const beak = add(bird.pos, scale(direction, bird.size * 0.45));
    lines.push(...worldToGl(...left), ...worldToGl(...beak), ...worldToGl(...beak), ...worldToGl(...right));
  }
  drawColor(thickenLines(lines, [0, 0.12]), [0.92, 0.9, 0.82, 0.78], m, gl.LINES);
}

function thickenLines(lines, offsets) {
  const result = [];
  for (const offset of offsets) {
    for (let i = 0; i < lines.length; i += 6) {
      result.push(
        lines[i] + offset, lines[i + 1], lines[i + 2] + offset,
        lines[i + 3] + offset, lines[i + 4], lines[i + 5] + offset,
      );
    }
  }
  return result;
}

function wireframeLines(wireframe) {
  const groups = { thin: [], bold: [] };
  for (const segment of wireframe.segments || []) {
    const points = Array.isArray(segment) ? segment : segment.points;
    const style = Array.isArray(segment) ? "thin" : segment.style || "thin";
    if (!points || points.length !== 2) continue;
    const target = style === "bold" ? groups.bold : groups.thin;
    target.push(...worldToGl(points[0][0], points[0][1], points[0][2]));
    target.push(...worldToGl(points[1][0], points[1][1], points[1][2]));
  }
  return groups;
}

function drawWireframes(m) {
  for (const wireframe of state.wireframes) {
    const groups = wireframeLines(wireframe);
    const color = wireframe.color || [1, 1, 1];
    if (groups.thin.length) drawColor(thickenLines(groups.thin, [0, 0.18, -0.18, 0.36]), [...color, 0.78], m, gl.LINES);
    if (groups.bold.length) drawColor(thickenLines(groups.bold, [0, 0.18, -0.18, 0.36, -0.36, 0.54]), [...color, 0.92], m, gl.LINES);
  }
}

function sunshineSkywayBlinkerPoints() {
  const north = state.landmarks.find((item) => item.name === "Sunshine Skyway Bridge (N)")?.xyz;
  const south = state.landmarks.find((item) => item.name === "Sunshine Skyway Bridge (S)")?.xyz;
  return north && south ? [north, south] : null;
}

function drawSunshineSkywayBlinkers(m) {
  const points = sunshineSkywayBlinkerPoints();
  if (!points) return;
  const active = Math.floor(state.weatherTime * 2) % 2;
  const basis = { right: [1, 0, 0], forward: [0, 1, 0], up: [0, 0, 1] };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const origin = [p[0], p[1], p[2] + 2.25];
    const mesh = [];
    pushBox(mesh, [-2.25, -2.25, -2.25], [2.25, 2.25, 2.25]);
    drawColor(meshVertices(mesh, basis, origin), i === active ? [1, 0.02, 0.01, 0.98] : [0.45, 0.01, 0.01, 0.24], m);
  }
}

function drawSkyViewWheel(m) {
  const centerHeight = SKYVIEW_WHEEL_TOP - SKYVIEW_WHEEL_RADIUS;
  const center = [SKYVIEW_WHEEL_POS[0], SKYVIEW_WHEEL_POS[1], centerHeight];
  const basis = actorBasis({ yaw: SKYVIEW_WHEEL_YAW, pitch: 0, roll: 0 });
  const right = basis.right;
  const up = [0, 0, 1];
  const forward = basis.forward;
  const radius = SKYVIEW_WHEEL_RADIUS;
  const spin = state.weatherTime * 2.9;
  const blink = Math.floor(state.weatherTime * 10);
  const palette = [
    [1.0, 0.92, 0.12, 0.96],
    [1.0, 0.46, 0.06, 0.96],
    [1.0, 0.08, 0.08, 0.96],
    [1.0, 0.1, 0.88, 0.96],
    [0.0, 0.92, 1.0, 0.96],
    [0.18, 0.35, 1.0, 0.96],
    [0.15, 1.0, 0.25, 0.96],
  ];
  const groups = palette.map(() => []);
  const supports = [];
  const glow = [];
  const point = (angle, r = radius) => add(center, add(scale(right, Math.cos(angle) * r), scale(up, Math.sin(angle) * r)));
  const pushLine = (target, a, b) => {
    target.push(...worldToGl(a[0], a[1], a[2]));
    target.push(...worldToGl(b[0], b[1], b[2]));
  };
  const colorGroup = (index, pulse = 0) => groups[(index + blink + pulse) % groups.length];

  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const b = (i + 1) / 48 * Math.PI * 2;
    pushLine(colorGroup(i), point(a), point(b));
  }
  for (let i = 0; i < 18; i++) {
    const a = spin + i / 18 * Math.PI * 2;
    pushLine(colorGroup(i, Math.floor(Math.sin(state.weatherTime * 7 + i) * 2 + 2)), center, point(a, radius * 0.95));
  }
  for (let i = 0; i < 18; i++) {
    const a = spin + i / 18 * Math.PI * 2;
    const p = point(a, radius * 0.94);
    const q = add(p, scale(up, -3.4));
    pushLine(colorGroup(i + 3), p, q);
  }

  const hubLeft = add(center, scale(right, -4));
  const hubRight = add(center, scale(right, 4));
  const hubUp = add(center, scale(up, 4));
  const hubDown = add(center, scale(up, -4));
  pushLine(glow, hubLeft, hubRight);
  pushLine(glow, hubUp, hubDown);

  const footLeft = add(add(SKYVIEW_WHEEL_POS, scale(right, -25)), scale(forward, -4));
  const footRight = add(add(SKYVIEW_WHEEL_POS, scale(right, 25)), scale(forward, -4));
  const rearLeft = add(add(SKYVIEW_WHEEL_POS, scale(right, -17)), scale(forward, 17));
  const rearRight = add(add(SKYVIEW_WHEEL_POS, scale(right, 17)), scale(forward, 17));
  const axle = add(center, scale(up, -3));
  pushLine(supports, footLeft, axle);
  pushLine(supports, footRight, axle);
  pushLine(supports, rearLeft, add(center, scale(right, -6)));
  pushLine(supports, rearRight, add(center, scale(right, 6)));
  pushLine(supports, footLeft, footRight);
  pushLine(supports, rearLeft, rearRight);

  drawColor(thickenLines(supports, [0, 0.2, -0.2, 0.4]), [0.82, 0.96, 0.88, 0.88], m, gl.LINES);
  drawColor(thickenLines(glow, [0, 0.18, -0.18, 0.36, -0.36]), [0.96, 1, 0.9, 0.98], m, gl.LINES);
  for (let i = 0; i < groups.length; i++) {
    const lines = groups[i];
    if (!lines.length) continue;
    const pulse = 0.78 + 0.22 * Math.sin(state.weatherTime * 12 + i * 1.7);
    const color = palette[i];
    drawColor(thickenLines(lines, [0, 0.2, -0.2, 0.4]), [color[0] * pulse, color[1] * pulse, color[2] * pulse, color[3]], m, gl.LINES);
  }
}

function cameraThumbnailVertices(camera) {
  if (!camera.xyz || !camera.ypr || !camera.fov) return null;
  const hf = Math.tan((camera.fov[0] || 50) * Math.PI / 360);
  const vf = Math.tan((camera.fov[1] || 35) * Math.PI / 360);
  const corners = [[-hf, vf], [hf, vf], [hf, -vf], [-hf, -vf]].map(([u, v]) => {
    const d = directionFromYpr(camera.ypr, u, v);
    return worldToGl(
      camera.xyz[0] + d[0] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[1] + d[1] * CAMERA_THUMBNAIL_DISTANCE,
      camera.xyz[2] + d[2] * CAMERA_THUMBNAIL_DISTANCE,
    );
  });
  return [
    ...corners[0], 0, 1,
    ...corners[1], 1, 1,
    ...corners[2], 1, 0,
    ...corners[0], 0, 1,
    ...corners[2], 1, 0,
    ...corners[3], 0, 0,
  ];
}

function drawCameraThumbnails(m) {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const camera of state.cameras) {
    if (!camera.texture?.loaded || camera.name?.endsWith(" Fake Cam")) continue;
    const vertices = cameraThumbnailVertices(camera);
    if (!vertices) continue;
    drawTextured(vertices, camera.texture.texture, m, 0.62);
  }
  gl.disable(gl.BLEND);
}

function landmarkModelVertices(model) {
  if (model.shape === "pyramid") return landmarkPyramidVertices(model);
  const [x, y] = model.xyz;
  const width = model.width || 25;
  const height = model.height || model.xyz[2] || 80;
  const half = width / 2;
  const corners = {
    nw: [x - half, y + half, 0],
    ne: [x + half, y + half, 0],
    se: [x + half, y - half, 0],
    sw: [x - half, y - half, 0],
    tnw: [x - half, y + half, height],
    tne: [x + half, y + half, height],
    tse: [x + half, y - half, height],
    tsw: [x - half, y - half, height],
  };
  const vertices = [];
  const face = (a, b, c, d, slice) => {
    const u0 = slice / 4;
    const u1 = (slice + 1) / 4;
    vertices.push(
      ...worldToGl(...a), u0, 0,
      ...worldToGl(...b), u1, 0,
      ...worldToGl(...c), u1, 1,
      ...worldToGl(...a), u0, 0,
      ...worldToGl(...c), u1, 1,
      ...worldToGl(...d), u0, 1,
    );
  };
  face(corners.sw, corners.se, corners.tse, corners.tsw, 0);
  face(corners.se, corners.ne, corners.tne, corners.tse, 1);
  face(corners.ne, corners.nw, corners.tnw, corners.tne, 2);
  face(corners.nw, corners.sw, corners.tsw, corners.tnw, 3);
  return vertices;
}

function landmarkPyramidVertices(model) {
  const [x, y] = model.xyz;
  const width = model.width || (model.height || model.xyz[2] || 100) * 2;
  const height = model.height || model.xyz[2] || 100;
  const half = width / 2;
  const apex = [x, y, height];
  const corners = {
    nw: [x - half, y + half, 0],
    ne: [x + half, y + half, 0],
    se: [x + half, y - half, 0],
    sw: [x - half, y - half, 0],
  };
  const vertices = [];
  const face = (a, b, slice) => {
    const u0 = slice / 4;
    const u1 = (slice + 1) / 4;
    const um = (u0 + u1) / 2;
    vertices.push(
      ...worldToGl(...a), u0, 0,
      ...worldToGl(...b), u1, 0,
      ...worldToGl(...apex), um, 1,
    );
  };
  face(corners.sw, corners.se, 0);
  face(corners.se, corners.ne, 1);
  face(corners.ne, corners.nw, 2);
  face(corners.nw, corners.sw, 3);
  return vertices;
}

function drawLandmarkModels(m) {
  for (const model of state.landmarkModels) {
    if (!model.texture?.loaded) continue;
    drawTextured(model.vertices, model.texture.texture, m, 1);
  }
}

function drawOverlay(m) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  drawStarsOverlay(m);
  if (state.storm) {
    ctx.fillStyle = state.night ? "rgba(0, 0, 0, 0.22)" : "rgba(16, 24, 34, 0.08)";
    ctx.fillRect(0, 0, state.width, state.height);
    drawRainOverlay();
  }
  if (state.lightning > 0) {
    ctx.fillStyle = `rgba(210,230,255,${state.lightning * 2.8})`;
    ctx.fillRect(0, 0, state.width, state.height);
    drawLightningOverlay();
  }
  if (state.stickFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${state.stickFlash * 0.32})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  if (state.deadZoneResetAt) {
    const alpha = clamp(1 - (state.deadZoneResetAt - state.weatherTime), 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  drawDebugOverlay();
  drawBlockedPopup();
  ctx.font = "12px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const target of state.targets) {
    if (target.dead) continue;
    const p = transformPoint(m, worldToGl(...target.pos));
    if (p[2] < -1 || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * state.width;
    const y = (-p[1] * 0.5 + 0.5) * state.height;
    ctx.fillStyle = "rgba(185,255,216,0.9)";
    ctx.fillText(target.name, x, y - 18);
  }
  for (const boat of state.boats) {
    if (!boat.message || state.weatherTime > boat.messageUntil) continue;
    const p = transformPoint(m, worldToGl(...boat.pos));
    if (p[2] < -1 || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * state.width;
    const y = (-p[1] * 0.5 + 0.5) * state.height - 32;
    ctx.save();
    ctx.font = "16px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
    const w = ctx.measureText(boat.message).width + 22;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 15, w, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillText(boat.message, x, y + 1);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(state.width / 2 - 10, state.height / 2);
  ctx.lineTo(state.width / 2 + 10, state.height / 2);
  ctx.moveTo(state.width / 2, state.height / 2 - 10);
  ctx.lineTo(state.width / 2, state.height / 2 + 10);
  ctx.stroke();
  drawAttitudeCue();
  ctx.restore();
}

function drawStarsOverlay(m) {
  if (!state.night) return;
  ctx.save();
  ctx.fillStyle = "rgba(235,245,255,0.85)";
  for (const star of state.stars) {
    const pos = add(state.camera.eye, scale(star.dir, 18000));
    const p = transformPoint(m, worldToGl(...pos));
    if (p[2] < -1 || p[2] > 1) continue;
    const x = (p[0] * 0.5 + 0.5) * state.width;
    const y = (-p[1] * 0.5 + 0.5) * state.height;
    if (x < -4 || x > state.width + 4 || y < -4 || y > state.height + 4) continue;
    ctx.globalAlpha = star.alpha;
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDebugOverlay() {
  if (state.weatherTime > state.debugUntil || !state.debugLines.length) return;
  const fadeIn = clamp((state.weatherTime - state.debugStarted) / 0.12, 0, 1);
  const fadeOut = clamp((state.debugUntil - state.weatherTime) / 0.65, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const fontSize = Math.max(15, Math.round(state.width / 119));
  const lineHeight = Math.round(fontSize * 1.08);
  const x = Math.round(state.width * 0.02);
  const y = Math.round(state.height * 0.02);
  const width = Math.min(Math.round(state.width * 0.72), 1500);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${fontSize}px Menlo, Monaco, Consolas, "Courier New", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x - 2, y - 2, width + 4, state.debugLines.length * lineHeight + 4);
  ctx.shadowColor = "rgba(220, 245, 230, 0.28)";
  ctx.shadowBlur = 1.2;
  const elapsed = Math.max(0, state.weatherTime - state.debugStarted);
  for (let i = 0; i < state.debugLines.length; i++) {
    const line = state.debugLines[i];
    const typed = clamp((elapsed - i * 0.07) / 0.014, 0, line.text.length);
    const text = line.text.slice(0, Math.floor(typed));
    if (!text) continue;
    const yy = y + i * lineHeight;
    if (line.band) {
      ctx.fillStyle = i % 2 ? "rgba(232,238,240,0.54)" : "rgba(24,29,34,0.58)";
      ctx.fillRect(x, yy, width, lineHeight);
    }
    ctx.fillStyle = line.color;
    ctx.fillText(text, x + 4, yy - 1);
    if (state.weatherTime < state.debugHoldAt && Math.floor(typed) < line.text.length && Math.floor(state.weatherTime * 12) % 2 === 0) {
      ctx.fillText("_", x + 4 + ctx.measureText(text).width + 2, yy - 1);
    }
  }
  ctx.restore();
}

function drawBlockedPopup() {
  if (state.weatherTime > state.blockedPopupUntil) return;
  const width = Math.round(state.width * 0.5);
  const height = Math.round(state.height * 0.5);
  const x = Math.round((state.width - width) / 2);
  const y = Math.round((state.height - height) / 2);
  const fontSize = Math.max(34, Math.round(Math.min(state.width, state.height) / 15));
  ctx.save();
  ctx.fillStyle = "rgba(118, 118, 118, 0.92)";
  ctx.strokeStyle = "rgba(215, 215, 215, 0.78)";
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(42, 255, 70, 0.96)";
  ctx.fillText(`Blocked Popups (${state.blockedPopupCount})`, state.width / 2, state.height / 2 + 2);
  ctx.restore();
}

function drawAttitudeCue() {
  const cx = state.width / 2;
  const cy = state.height * 0.72;
  const roll = -state.plane.roll;
  const pitchOffset = clamp(state.plane.pitch * 80, -48, 48);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-52, pitchOffset);
  ctx.lineTo(-14, pitchOffset);
  ctx.moveTo(14, pitchOffset);
  ctx.lineTo(52, pitchOffset);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,217,97,0.9)";
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(18, 0);
  ctx.stroke();
  ctx.restore();
}

function drawRainOverlay() {
  const count = Math.floor((state.width * state.height) / 18500);
  const speed = state.weatherTime * 850;
  ctx.save();
  ctx.lineWidth = Math.max(1, state.width / 1600);
  ctx.strokeStyle = "rgba(185, 208, 235, 0.34)";
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const x0 = ((seed / 233280) * state.width + (state.weatherTime * 60) % state.width) % state.width;
    const y0 = (((seed * 37) % 233280) / 233280 * state.height + speed) % state.height;
    const length = 18 + ((seed * 17) % 34);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - length * 0.45, y0 + length);
  }
  ctx.stroke();
  ctx.restore();
}

function drawLightningOverlay() {
  if (!state.lightningBolt) return;
  const bolt = state.lightningBolt;
  const x = bolt.x * state.width;
  const y = bolt.y * state.height;
  const segments = 7;
  ctx.save();
  ctx.strokeStyle = `rgba(230, 244, 255, ${Math.min(1, state.lightning * 7)})`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(180,220,255,0.9)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const jitter = Math.sin(i * 12.989 + bolt.bend * 20) * 26;
    ctx.lineTo(x + bolt.bend * state.width * t + jitter, y + t * state.height * 0.45);
  }
  ctx.stroke();
  ctx.restore();
}

function render() {
  resize();
  gl.viewport(0, 0, state.width, state.height);
  const sky = state.night ? [0, 0, 0, 1] : (state.storm ? [0.18, 0.22, 0.29, 1] : [0.43, 0.72, 0.92, 1]);
  gl.clearColor(...sky);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const m = matrix();
  gl.disable(gl.DEPTH_TEST);
  drawWater(m);
  for (const tile of state.tiles.filter((tile) => tile?.z === TILE_Z)) drawTile(tile, m);
  for (const tile of state.tiles.filter((tile) => tile?.z > TILE_Z).sort((a, b) => a.z - b.z)) drawTile(tile, m);
  drawMapLabels(m);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  drawImagePanels(m);
  drawLandmarkModels(m);
  drawWireframes(m);
  drawSunshineSkywayBlinkers(m);
  drawSkyViewWheel(m);
  drawCameraThumbnails(m);
  drawBullets(m);
  drawBirds(m);
  drawBoats(m);
  drawCruiseShip(m);
  drawContainerShip(m);
  drawGolfCarts(m);
  drawBlimp(m);
  drawChopper(m);
  drawAirliner(m);
  drawKeysSeaplane(m);
  drawFighterJet(m);
  drawPlane(m);
  drawSprites(m);
  gl.disable(gl.BLEND);
  drawOverlay(m);
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;
    state.width = width;
    state.height = height;
  }
}

function makeTargets() {
  const candidates = state.landmarks.filter((item) => item.xyz && item.xyz[2] > 20 && item.xyz[2] < 260);
  state.targets = [];
  for (let i = 0; i < 12 && candidates.length; i++) {
    const index = Math.floor(Math.random() * candidates.length);
    const landmark = candidates.splice(index, 1)[0];
    state.targets.push({ name: landmark.name, pos: [landmark.xyz[0], landmark.xyz[1], landmark.xyz[2] + 28], radius: 24, dead: false });
  }
}

function initializeAmbientActors() {
  const landmark = (name) => state.landmarks.find((item) => item.name === name)?.xyz;
  const blimpBay = landmark("Blimp Bay");
  if (blimpBay) state.blimp.pos = [blimpBay[0], blimpBay[1], 190];
  const lakeNorth = landmark("Lake Leonida (A)") || landmark("Lake Leonida (N)");
  if (lakeNorth) state.chopper.pos = [lakeNorth[0], lakeNorth[1] - 180, 175];
  // Keep these as explicit water corridors: offshore Keys/channel routes, not random wandering.
  state.boats = [
    { route: [[-5200, -7600, 1.6], [-3450, -7350, 1.6]], t: 0.08, speed: 0.018, message: "", messageUntil: 0 },
    { route: [[-4550, -6400, 1.6], [-2850, -6100, 1.6]], t: 0.42, speed: 0.015, message: "", messageUntil: 0 },
    { route: [[-2800, -5000, 1.6], [-900, -4450, 1.6]], t: 0.68, speed: 0.013, message: "", messageUntil: 0 },
    { route: [[-900, -3350, 1.6], [1050, -2850, 1.6]], t: 0.25, speed: 0.012, message: "", messageUntil: 0 },
  ];
  state.jetSkis = Array.from({ length: 3 }, (_, index) => {
    const pos = randomJetSkiPoint();
    const target = randomJetSkiPoint();
    const colors = [[1, 0.82, 0.05, 1], [1, 0.18, 0.12, 1], [0.12, 0.78, 1, 1]];
    return {
      pos,
      target,
      yaw: Math.atan2(-(target[0] - pos[0]), target[1] - pos[1]),
      speed: 72 + index * 9 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      color: colors[index % colors.length],
    };
  });
  state.golfCarts = Array.from({ length: 2 }, (_, index) => {
    const pos = randomGolfCartPoint();
    const target = randomGolfCartPoint();
    return {
      pos,
      target,
      yaw: Math.atan2(-(target[0] - pos[0]), target[1] - pos[1]),
      speed: 10 + index * 1.6,
      wait: Math.random() * 3,
    };
  });
}

async function loadData() {
  initializeMapLabels();
  initializeImagePanels();
  state.iconTexture = loadImageTexture(ICON_TEXTURE);
  const [base, result, colors, fourSeasons, sunshineSkyway, hanksWaffles, landmarkModels] = await Promise.all([
    fetch(VC_DATA).then((r) => r.json()),
    fetch(VC_RESULT).then((r) => r.ok ? r.json() : null).catch(() => null),
    loadJson(VC_MAP3D_COLORS).catch(() => null),
    loadJson(VC_FOUR_SEASONS_WIREFRAME).catch(() => null),
    loadJson(VC_SUNSHINE_SKYWAY_WIREFRAME).catch(() => null),
    loadJson(VC_HANKS_WAFFLES_WIREFRAME).catch(() => null),
    loadJson(LANDMARK_MODELS).catch(() => null),
  ]);
  if (colors?.schema === "gtamaplibvc-map3d-colors-v1") {
    for (const [name, color] of Object.entries(colors.colors || {})) state.colors.set(name, color);
  }
  if (fourSeasons?.schema === "gtamaplibvc-map3d-four-seasons-v1") {
    fourSeasons.color = colorForName("Four Seasons Hotel Miami");
    state.wireframes.push(fourSeasons);
  }
  if (sunshineSkyway?.schema === "gtamaplibvc-map3d-sunshine-skyway-v1") {
    sunshineSkyway.color = colorForName("Sunshine Skyway Bridge");
    state.wireframes.push(sunshineSkyway);
  }
  if (hanksWaffles?.schema === "gtamaplibvc-map3d-hanks-waffles-v1") {
    hanksWaffles.color = colorForName("536 Richard Jackson Blvd");
    state.wireframes.push(hanksWaffles);
  }
  const resultCameras = result?.cameras || {};
  const resultLandmarks = result?.landmarks || {};
  state.cameras = base.cameras
    .map((camera) => ({ ...camera, ...(resultCameras[camera.name] || {}) }))
    .filter((camera) => camera.xyz && !isLeakCamera(camera) && camera.name !== "AI World Editor Map (4K)" && !camera.name?.endsWith(" Fake Cam"))
    .map((camera) => ({
      ...camera,
      texture: camera.thumbnail ? loadImageTexture(`../${camera.thumbnail}`) : null,
    }));
  const landmarkMap = new Map(base.landmarks.map((item) => [item.name, item]));
  for (const [name, xyz] of Object.entries(resultLandmarks)) {
    landmarkMap.set(name, { ...(landmarkMap.get(name) || { name }), xyz });
  }
  state.landmarks = [...landmarkMap.values()].filter((item) => item.xyz);
  state.prisonTowers = state.landmarks
    .filter((item) => /^Prison Tower \([1-6]\)$/.test(item.name))
    .map((item) => ({
      name: item.name,
      pos: [item.xyz[0], item.xyz[1], item.xyz[2] + 20],
      cooldown: Math.random() * 1.2,
    }));
  if (landmarkModels?.schema === "gtamaplib-vvc-landmarks-v1") {
    state.landmarkModels = (landmarkModels.landmarks || []).map((model) => ({
      ...model,
      vertices: landmarkModelVertices(model),
      texture: loadImageTexture(model.texture),
    }));
  }
  makeTargets();
  initializeAmbientActors();
  igniteFourSeasons();
  state.camera.eye = add(state.plane.pos, [-60, -80, 35]);
  state.camera.target = [...state.plane.pos];
  spawnBirdFlock();
}

function tick(now) {
  if (!state.running) return;
  const dt = Math.min(0.035, (now - state.lastTime) / 1000 || 0.016);
  state.lastTime = now;
  update(dt, now);
  render();
  state.frame = requestAnimationFrame(tick);
}

function distortionCurve(amount = 95) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * amount) * 0.72 + x * 0.08;
  }
  return curve;
}

function phoneLinePath(conversation, lineIndex) {
  return `${conversation.folder}/dialogue_${String(lineIndex + 1).padStart(2, "0")}.mp3`;
}

function phoneConversationNumber(conversation) {
  const match = conversation.folder.match(/conversation_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function setNextPhoneConversation(number) {
  const phone = state.phone;
  const conversationNumber = Number(number);
  if (!Number.isInteger(conversationNumber)) {
    return `phone: invalid conversation ${number}`;
  }
  const index = phone.conversations.findIndex((conversation) =>
    phoneConversationNumber(conversation) === conversationNumber);
  if (index === -1) {
    return `phone: conversation ${conversationNumber} not found`;
  }
  phone.conversationIndex = index;
  if (!phone.playing) {
    phone.availableAt = Math.min(phone.availableAt, state.weatherTime);
    updatePhoneButtonVisibility();
  }
  return `phone: next conversation ${String(conversationNumber).padStart(2, "0")}`;
}

function setPlaneDebugLocation(location) {
  if (location !== "zero") {
    return `plane: unknown location ${location}`;
  }
  Object.assign(state.plane, {
    pos: [0, 0, 100],
    vel: [0, 92, 2],
    yaw: 0,
    pitch: 0.04,
    roll: 0,
    throttle: 0.68,
    hp: 100,
  });
  state.deadZoneCrash = false;
  state.deadZoneResetAt = 0;
  state.camera.eye = add(state.plane.pos, [0, -CAMERA_CHASE * 1.6, CAMERA_UP + 35]);
  state.camera.target = [...state.plane.pos];
  statusEl.textContent = "debug plane zero";
  return "plane: zero";
}

function debugCommand(method, value) {
  let command = method;
  let argument = value;
  if (typeof method === "string" && value === undefined) {
    const parts = method.trim().split(/\s+/);
    [command, argument] = parts;
  }
  if (command === "phone") return setNextPhoneConversation(argument);
  if (command === "plane") return setPlaneDebugLocation(argument);
  return `debug: unknown method ${command}`;
}

function ensurePhoneAudio() {
  const phone = state.phone;
  if (phone.audio) return;

  phone.audio = new Audio();
  phone.audio.preload = "auto";
  phone.audio.crossOrigin = "anonymous";
  phone.audio.addEventListener("ended", scheduleNextPhoneLine);

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  phone.context = new AudioCtx();
  phone.source = phone.context.createMediaElementSource(phone.audio);
  phone.gain = phone.context.createGain();
  const deadZoneGain = state.plane.pos[1] > DEAD_ZONE_START ? 0.5 : 1;
  phone.gain.gain.value = phone.baseGain * deadZoneGain;
  phone.source.connect(phone.gain).connect(phone.context.destination);
}

function clearPhonePause() {
  if (!state.phone.pauseTimeout) return;
  clearTimeout(state.phone.pauseTimeout);
  state.phone.pauseTimeout = null;
}

function stopPhone(status = "phone: disconnected") {
  const phone = state.phone;
  clearPhonePause();
  if (phone.audio) {
    phone.audio.pause();
    phone.audio.removeAttribute("src");
    phone.audio.load();
  }
  phone.playing = false;
  phone.activeConversation = null;
  phone.lineIndex = 0;
  phone.duckReleaseAt = state.weatherTime + 0.5;
  phone.availableAt = state.weatherTime + 5;
  phoneButton.textContent = "phone";
  updatePhoneButtonVisibility();
  statusEl.textContent = status;
}

async function playPhoneLine() {
  const phone = state.phone;
  if (!phone.playing || !phone.activeConversation) return;
  if (phone.lineIndex >= phone.activeConversation.count) {
    stopPhone();
    return;
  }

  phone.audio.src = phoneLinePath(phone.activeConversation, phone.lineIndex);
  try {
    await phone.audio.play();
  } catch (_error) {
    stopPhone("phone: no signal");
  }
}

function scheduleNextPhoneLine() {
  const phone = state.phone;
  if (!phone.playing) return;
  phone.lineIndex += 1;
  if (phone.lineIndex >= phone.activeConversation.count) {
    stopPhone();
    return;
  }
  const delay = 1000 + Math.random() * 2000;
  clearPhonePause();
  phone.pauseTimeout = setTimeout(playPhoneLine, delay);
}

async function togglePhone() {
  const phone = state.phone;
  if (phone.playing) {
    stopPhone("phone: hung up");
    return;
  }
  if (state.weatherTime < phone.availableAt) return;

  ensurePhoneAudio();
  if (phone.context.state === "suspended") await phone.context.resume();

  phone.activeConversation = phone.conversations[phone.conversationIndex];
  phone.conversationIndex = (phone.conversationIndex + 1) % phone.conversations.length;
  phone.lineIndex = 0;
  phone.duckReleaseAt = 0;
  phone.playing = true;
  phoneButton.textContent = "hang up";
  updatePhoneButtonVisibility();
  statusEl.textContent = "phone: connected";
  playPhoneLine();
}

async function toggleSound() {
  const sound = state.sound;
  if (!sound.audio) {
    sound.audio = new Audio(sound.tracks[sound.trackIndex]);
    sound.audio.loop = false;
    sound.audio.preload = "auto";
    sound.audio.crossOrigin = "anonymous";
    sound.audio.addEventListener("ended", () => {
      if (!sound.playing) return;
      sound.trackIndex = (sound.trackIndex + 1) % sound.tracks.length;
      sound.audio.src = sound.tracks[sound.trackIndex];
      sound.audio.playbackRate = 0.96;
      sound.audio.play().catch(() => {
        sound.playing = false;
        sound.audible = false;
        radioButton.textContent = "radio";
      });
    });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sound.context = new AudioCtx();
    sound.source = sound.context.createMediaElementSource(sound.audio);

    sound.highpass = sound.context.createBiquadFilter();
    sound.highpass.type = "highpass";
    sound.highpass.frequency.value = RADIO_FILTER.highpassFrequency;
    sound.highpass.Q.value = RADIO_FILTER.highpassQ;

    sound.lowpass = sound.context.createBiquadFilter();
    sound.lowpass.type = "lowpass";
    sound.lowpass.frequency.value = RADIO_FILTER.lowpassFrequency;
    sound.lowpass.Q.value = RADIO_FILTER.lowpassQ;

    sound.shaper = sound.context.createWaveShaper();
    sound.shaper.curve = distortionCurve(RADIO_FILTER.distortion);
    sound.shaper.oversample = "4x";

    sound.compressor = sound.context.createDynamicsCompressor();
    sound.compressor.threshold.value = RADIO_FILTER.compressorThreshold;
    sound.compressor.knee.value = RADIO_FILTER.compressorKnee;
    sound.compressor.ratio.value = RADIO_FILTER.compressorRatio;
    sound.compressor.attack.value = RADIO_FILTER.compressorAttack;
    sound.compressor.release.value = RADIO_FILTER.compressorRelease;

    sound.tremoloGain = sound.context.createGain();
    sound.tremoloGain.gain.value = RADIO_FILTER.tremoloBase;
    sound.tremolo = sound.context.createOscillator();
    sound.tremolo.type = "sine";
    sound.tremolo.frequency.value = RADIO_FILTER.tremoloFrequency;
    const tremoloDepth = sound.context.createGain();
    tremoloDepth.gain.value = RADIO_FILTER.tremoloDepth;
    sound.tremolo.connect(tremoloDepth).connect(sound.tremoloGain.gain);
    sound.tremolo.start();

    sound.master = sound.context.createGain();
    const weatherGain = 1 - 0.5 * clamp(state.turbulence, 0, 1);
    const phoneDuckGain = state.phone.playing || state.weatherTime < state.phone.duckReleaseAt ? 0.2 : 1;
    sound.master.gain.value = 0;
    sound.source
      .connect(sound.highpass)
      .connect(sound.lowpass)
      .connect(sound.shaper)
      .connect(sound.compressor)
      .connect(sound.tremoloGain)
      .connect(sound.master)
      .connect(sound.context.destination);
  }
  if (sound.context.state === "suspended") await sound.context.resume();
  if (sound.audible) {
    stopRadio();
    return;
  }
  if (!sound.audio.src) {
    sound.audio.src = sound.tracks[sound.trackIndex];
  }
  const weatherGain = 1 - 0.5 * clamp(state.turbulence, 0, 1);
  const phoneDuckGain = state.phone.playing || state.weatherTime < state.phone.duckReleaseAt ? 0.2 : 1;
  sound.master.gain.cancelScheduledValues(sound.context.currentTime);
  sound.master.gain.setValueAtTime(0, sound.context.currentTime);
  sound.master.gain.linearRampToValueAtTime(sound.baseGain * weatherGain * phoneDuckGain, sound.context.currentTime + 0.08);
  try {
    sound.audio.playbackRate = 0.96;
    if (!sound.playing || sound.audio.paused) await sound.audio.play();
    sound.playing = true;
    sound.audible = true;
    radioButton.textContent = "turn off";
    statusEl.textContent = "radio: busted distant signal";
  } catch (_error) {
    sound.playing = false;
    sound.audible = false;
    radioButton.textContent = "radio";
    statusEl.textContent = "missing radio tracks";
  }
}

function stopRadio() {
  const sound = state.sound;
  if (!sound.audio || !sound.master || !sound.context) return;
  const now = sound.context.currentTime;
  sound.audible = false;
  radioButton.textContent = "radio";
  sound.master.gain.cancelScheduledValues(now);
  sound.master.gain.setValueAtTime(sound.master.gain.value, now);
  sound.master.gain.linearRampToValueAtTime(0, now + 0.08);
}

function skipRadioTrack(direction) {
  const sound = state.sound;
  sound.trackIndex = (sound.trackIndex + direction + sound.tracks.length) % sound.tracks.length;
  if (!sound.audio) return;
  sound.audio.src = sound.tracks[sound.trackIndex];
  sound.audio.playbackRate = 0.96;
  if (!sound.playing) return;
  sound.audio.play().catch(() => {
    sound.playing = false;
    sound.audible = false;
    radioButton.textContent = "radio";
  });
}

function exitVisualMode() {
  state.visualMode = null;
  if (state.trevorTimeout) {
    clearTimeout(state.trevorTimeout);
    state.trevorTimeout = null;
  }
  updateTrevorClass();
}

function cycleVisualMode() {
  const index = VISUAL_MODE_CLASSES.indexOf(state.visualMode);
  state.visualMode = VISUAL_MODE_CLASSES[index + 1] || null;
  if (state.trevorTimeout) clearTimeout(state.trevorTimeout);
  state.trevorTimeout = state.visualMode ? setTimeout(exitVisualMode, 60000) : null;
  updateTrevorClass();
}

function installControls() {
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === " ") event.preventDefault();
    if (event.key === "/") {
      event.preventDefault();
      toggleSound();
      return;
    }
    if (event.key === "\\") {
      event.preventDefault();
      cycleVisualMode();
      return;
    }
    if (event.key === ",") skipRadioTrack(-1);
    if (event.key === ".") skipRadioTrack(1);
    if (event.key === "r" || event.key === "R") resetPlane();
    if (event.key === "t" || event.key === "T") state.storm = !state.storm;
    state.keys.add(event.key);
  });
  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key);
  });
  weatherButton.addEventListener("click", () => {
    state.storm = !state.storm;
  });
  dayNightButton.addEventListener("click", () => {
    state.night = !state.night;
  });
  phoneButton.addEventListener("click", togglePhone);
  radioButton.addEventListener("click", toggleSound);
  resetButton.addEventListener("click", (event) => {
    if (event.shiftKey) {
      setPlaneDebugLocation("zero");
      return;
    }
    resetPlane();
  });
  exitButton.addEventListener("click", () => {
    writeMap3dPose();
    stopGameLoop();
    window.location.replace("/#view=map3d");
  });
}

function isLeakCamera(camera) {
  return String(camera.id || "").trim().startsWith("L");
}

async function main() {
  window._debug = debugCommand;
  resize();
  installControls();
  loadTiles();
  await loadData();
  updateDetailTiles();
  state.frame = requestAnimationFrame((now) => {
    state.lastTime = now;
    tick(now);
  });
}

main();
