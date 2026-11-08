'use strict';

/**
 * Study resources and hands-on practicals for every subtopic.
 *
 * Resources are deliberately links that do not rot: a Wikipedia article for the concept, and a YouTube
 * search for lectures (a search page always exists; a single video can be deleted). Search terms name
 * creators that students commonly use for placement preparation. Admins can replace any of these with a
 * specific video, article or course from the Study items screen.
 *
 * Practicals exist only for the subjects that have no LeetCode problems (OOP, DBMS, OS, CN). DSA and SQL
 * are practised with problems instead.
 */

const wiki = (title) => `https://en.wikipedia.org/wiki/${title}`;
const youtube = (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// subject, subtopic, label used in titles, Wikipedia article, YouTube query, extra resource (optional)
const reading = [
  ['DSA', 'arrays', 'Arrays', 'Array_(data_structure)', 'arrays data structure dsa take u forward', { title: 'Visualise it: VisuAlgo', url: 'https://visualgo.net/en', minutes: 20 }],
  ['DSA', 'strings', 'Strings', 'String_(computer_science)', 'string algorithms dsa interview'],
  ['DSA', 'hashing', 'Hashing', 'Hash_table', 'hashing hash map dsa explained', { title: 'Visualise it: VisuAlgo hash table', url: 'https://visualgo.net/en/hashtable', minutes: 20 }],
  ['DSA', 'linked-list', 'Linked List', 'Linked_list', 'linked list dsa interview questions', { title: 'Visualise it: VisuAlgo linked list', url: 'https://visualgo.net/en/list', minutes: 20 }],
  ['DSA', 'stack-queue', 'Stack & Queue', 'Stack_(abstract_data_type)', 'stack and queue dsa explained'],
  ['DSA', 'trees', 'Trees', 'Binary_tree', 'binary tree traversal dsa take u forward', { title: 'Visualise it: VisuAlgo binary search tree', url: 'https://visualgo.net/en/bst', minutes: 20 }],
  ['DSA', 'graphs', 'Graphs', 'Graph_(abstract_data_type)', 'graph algorithms bfs dfs dijkstra dsa', { title: 'Visualise it: VisuAlgo graph traversal', url: 'https://visualgo.net/en/dfsbfs', minutes: 20 }],
  ['DSA', 'dynamic-programming', 'Dynamic Programming', 'Dynamic_programming', 'dynamic programming dsa playlist'],
  ['DSA', 'sorting-searching', 'Sorting & Searching', 'Sorting_algorithm', 'sorting and binary search dsa explained', { title: 'Visualise it: VisuAlgo sorting', url: 'https://visualgo.net/en/sorting', minutes: 20 }],

  ['OOP', 'oop-basics', 'Classes & Objects', 'Object-oriented_programming', 'java oop concepts classes and objects'],
  ['OOP', 'inheritance', 'Inheritance', 'Inheritance_(object-oriented_programming)', 'inheritance in java oop interview'],
  ['OOP', 'polymorphism', 'Polymorphism', 'Polymorphism_(computer_science)', 'polymorphism overloading overriding java'],
  ['OOP', 'abstraction-encapsulation', 'Abstraction & Encapsulation', 'Encapsulation_(computer_programming)', 'abstraction vs encapsulation java oop'],
  ['OOP', 'design-principles', 'SOLID & Design Principles', 'SOLID', 'solid principles explained with examples'],

  ['DBMS', 'er-model-keys', 'ER Model & Keys', 'Entity%E2%80%93relationship_model', 'er model and keys dbms gate smashers'],
  ['DBMS', 'normalization', 'Normalization', 'Database_normalization', 'normalization 1nf 2nf 3nf bcnf dbms gate smashers'],
  ['DBMS', 'transactions-acid', 'Transactions & ACID', 'ACID', 'transactions and acid properties dbms gate smashers'],
  ['DBMS', 'indexing', 'Indexing', 'Database_index', 'indexing in dbms b tree explained'],
  ['DBMS', 'concurrency-control', 'Concurrency Control', 'Concurrency_control', 'concurrency control and isolation levels dbms'],

  ['SQL', 'basic-queries', 'Basic Queries', 'SQL', 'sql basics select where order by tutorial', { title: 'Practise in the browser: SQLBolt', url: 'https://sqlbolt.com/', minutes: 30 }],
  ['SQL', 'joins', 'Joins', 'Join_(SQL)', 'sql joins explained inner left right full'],
  ['SQL', 'aggregation', 'Aggregation & GROUP BY', 'Aggregate_function', 'sql group by having aggregate functions'],
  ['SQL', 'subqueries', 'Subqueries', 'Subquery', 'sql subqueries correlated and nested'],
  ['SQL', 'advanced-sql', 'Window Functions & Advanced SQL', 'Window_function_(SQL)', 'sql window functions rank row_number interview'],

  ['OS', 'processes-threads', 'Processes & Threads', 'Thread_(computing)', 'process vs thread operating system gate smashers'],
  ['OS', 'cpu-scheduling', 'CPU Scheduling', 'Scheduling_(computing)', 'cpu scheduling algorithms fcfs sjf round robin gate smashers'],
  ['OS', 'memory-management', 'Memory Management', 'Memory_management', 'memory management paging segmentation operating system'],
  ['OS', 'synchronization-deadlocks', 'Synchronization & Deadlocks', 'Deadlock_(computer_science)', 'process synchronization and deadlock operating system'],
  ['OS', 'file-systems', 'File Systems & I/O', 'File_system', 'file system inode operating system explained'],

  ['CN', 'osi-tcp-ip', 'OSI & TCP/IP Models', 'OSI_model', 'osi model and tcp ip model computer networks gate smashers'],
  ['CN', 'ip-addressing', 'IP Addressing & Routing', 'IP_address', 'ip addressing subnetting computer networks'],
  ['CN', 'transport-layer', 'Transport Layer', 'Transport_layer', 'tcp vs udp transport layer computer networks'],
  ['CN', 'application-protocols', 'Application Layer Protocols', 'Application_layer', 'http dns smtp application layer protocols'],
  ['CN', 'network-security', 'Network Security', 'Network_security', 'network security tls ssl firewall basics'],
];

// subject, subtopic, title, instructions, minutes
const practicals = [
  ['OOP', 'oop-basics', 'Model a library in classes', 'In Java or C++ write Book, Member and Library classes. Use private fields, constructors and getters, and add a borrow() and a giveBack() method on Library. Write a main that borrows and returns two books and prints the result. Then write two sentences on what an object is that a class is not.', 30],
  ['OOP', 'inheritance', 'Build a Vehicle hierarchy', 'Create Vehicle with Car and Bike subclasses. Override one method and call super() in a constructor, then print from each constructor to see the order they run. Finish with a short note on why Java does not allow a class to extend two classes.', 30],
  ['OOP', 'polymorphism', 'Shapes: overload and override', 'Make an abstract Shape with area(). Add Circle and Rectangle that override it, and an overloaded describe() method. Put them in a List<Shape>, loop, and call area(). Write down which call is resolved at compile time and which at run time.', 30],
  ['OOP', 'abstraction-encapsulation', 'Encapsulate a bank account', 'Write an Account interface and a SavingsAccount class with a private balance. deposit() and withdraw() must reject bad input. Write what you hid, what you exposed, and why callers cannot break the balance.', 25],
  ['OOP', 'design-principles', 'Refactor a God class using SOLID', 'Take an OrderProcessor class that calculates totals, saves to a database and sends an email. Split it so each class has one reason to change (Single Responsibility), and make discount rules pluggable through an interface (Open/Closed). Name which SOLID letter each change fixes.', 40],
  ['OOP', 'design-principles', 'Sketch a parking lot design', 'Without code, list the classes for a parking lot (Lot, Level, Spot, Vehicle, Ticket), their relationships and one interface. Then solve the LeetCode problem Design Parking System and compare your design with your code.', 40],

  ['DBMS', 'er-model-keys', 'Draw an ER diagram for a college', 'Draw an ER diagram for Student, Course and Teacher with enrolment and teaching relationships. Mark cardinalities, one weak entity, and list the candidate, primary and foreign keys for each table you would create.', 30],
  ['DBMS', 'normalization', 'Normalise a table to 3NF', 'Take Orders(order_id, customer_id, customer_name, product_id, product_name, price, qty). List its functional dependencies, find the candidate key, and decompose the table to 3NF. Check that the decomposition is lossless and name the anomaly each step removes.', 30],
  ['DBMS', 'transactions-acid', 'Run a bank transfer as a transaction', 'In MySQL or PostgreSQL create an accounts table. Do a transfer inside BEGIN ... COMMIT, then repeat it and ROLLBACK halfway. Write which ACID property each result shows.', 30],
  ['DBMS', 'indexing', 'Measure what an index does', 'Create a table with 100,000 rows. Run EXPLAIN on a WHERE query, then CREATE INDEX on that column and run EXPLAIN again. Record the plan and the time before and after, and explain why the second is faster.', 35],
  ['DBMS', 'concurrency-control', 'Reproduce a lost update', 'Open two database sessions. Make both read the same balance and both write it back, and see one update disappear. Repeat with SELECT ... FOR UPDATE. Then write which isolation level prevents dirty reads, non-repeatable reads and phantoms.', 40],

  ['OS', 'processes-threads', 'Processes versus threads', 'On Linux or WSL run ps and top and find a process id and its thread count. Write a short program that starts three threads incrementing a shared counter without a lock and observe the wrong total. List three differences between a process and a thread.', 30],
  ['OS', 'cpu-scheduling', 'Draw Gantt charts by hand', 'For five processes with your own arrival and burst times, draw the Gantt chart for FCFS, SJF and Round Robin (quantum 2). Calculate the average waiting time and turnaround time for each and say which wins and why.', 35],
  ['OS', 'memory-management', 'Page replacement by hand', 'For the reference string 7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1 with 3 frames, count page faults for FIFO, LRU and Optimal. Show the frame contents after each reference.', 30],
  ['OS', 'synchronization-deadlocks', 'Producer and consumer', 'Implement a bounded buffer producer-consumer with semaphores or wait/notify. Then draw a resource allocation graph that deadlocks and list the four conditions that must hold for a deadlock to occur.', 45],
  ['OS', 'file-systems', 'Explore inodes and links', 'On Linux or WSL create a file, run ls -li, make a hard link and a symbolic link, then delete the original and see what still works. Write what an inode stores and why the hard link survived.', 25],

  ['CN', 'osi-tcp-ip', 'Trace one web request through the layers', 'Open your browser developer tools (Network tab), or Wireshark if you have it, and load a page. Write down what you see for the application, transport, network and link layers and map each to the OSI model.', 30],
  ['CN', 'ip-addressing', 'Subnet 192.168.10.0/24 by hand', 'Split 192.168.10.0/24 into four equal subnets. For each give the network address, broadcast address, mask and usable host range, then check against an online subnet calculator. Then run tracert (Windows) or traceroute and list the first five hops.', 35],
  ['CN', 'transport-layer', 'TCP versus UDP in practice', 'Run netstat -an (or ss -tn) and find TCP connections and their states. Draw the three-way handshake and the four-step close. Write three applications that choose UDP and why.', 30],
  ['CN', 'application-protocols', 'Speak HTTP and DNS yourself', 'Run nslookup example.com and curl -v https://example.com. Write the DNS record types you saw, the HTTP status line, and three response headers with what each does.', 25],
  ['CN', 'network-security', 'Inspect an HTTPS certificate', 'Open a site certificate in your browser. Note the issuer, validity dates and the chain. Explain in your own words what the TLS handshake achieves and how a man-in-the-middle would be detected.', 25],
];

const items = [];
for (const [subject, subtopic, label, article, video, extra] of reading) {
  items.push({ type: 'resource', subject, subtopic, title: `Read: ${label}`, description: 'Concept overview and terminology.', url: wiki(article), minutes: 20 });
  items.push({ type: 'resource', subject, subtopic, title: `Watch: ${label} lectures`, description: 'Search results for lecture videos; pick one you like and follow it through.', url: youtube(video), minutes: 30 });
  if (extra) items.push({ type: 'resource', subject, subtopic, title: extra.title, description: 'Interactive practice.', url: extra.url, minutes: extra.minutes });
}
for (const [subject, subtopic, title, description, minutes] of practicals) {
  items.push({ type: 'practical', subject, subtopic, title, description, url: '', minutes });
}

module.exports = { studyItems: items };
