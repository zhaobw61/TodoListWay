/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
 		/*生成唯一的ID*/
		uuid: function () {
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';
			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}
			return uuid;
		},
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};

	var App = {
		/*初始化数组*/
		init: function () {
			/*获取数据*/
			this.todos = util.store('todos-jquery');
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		/*绑定事件*/
		bindEvents: function () {
			/*创建新的任务*/
			$('#new-todo').on('keyup', this.create.bind(this));
			/*勾选按钮*/
			$('#toggle-all').on('change', this.toggleAll.bind(this));
			/*清除销毁项目*/
			$('#footer').on('click', '#clear-completed', this.destroyCompleted.bind(this));

			$('#todo-list')
				/*改变任务的状态*/
				.on('change', '.toggle', this.toggle.bind(this))
				/*双击后改变状态*/
				.on('dblclick', 'label', this.editingMode.bind(this))
				/*任务进入编辑模式的后对键盘的检测*/
				.on('keyup', '.edit', this.editKeyup.bind(this))
				/*失去焦点的时候*/
				.on('focusout', '.edit', this.update.bind(this))
				/*任务后面的小叉叉*/
				.on('click', '.destroy', this.destroy.bind(this));
		},
		/*改变html*/
		render: function () {
			console.log(this.todos);
			/*获取当前的数据*/
			var todos = this.getFilteredTodos();
			/*填充数据*/
			$('#todo-list').html(this.todoTemplate(todos));
			console.log(todos.length > 0);
			/*改变被隐藏的li*/
			$('#main').toggle(todos.length > 0);
			/*设置被选中的list*/
			$('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
			/*填充footer*/
			this.renderFooter();
			/*让输入框聚焦*/
			$('#new-todo').focus();
			/*保存数据*/
			util.store('todos-jquery', this.todos);
		},
		/*修改footer*/
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			/*填充footer模板的数据*/
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('#footer').toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		/*筛选在做的*/
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		/*筛选完成的*/
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		/*根据filter筛选任务*/
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		/*销毁完成的项*/
		destroyCompleted: function () {
			/*改变数组了,没有完成的给提取出来了*/
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		/*获取元素的id*/
		getIndexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		/*创建任务*/
		create: function (e) {
			var $input = $(e.target);
			var val = $input.val().trim();
			/*按键不是enter  并且内容为空*/
			if (e.which !== ENTER_KEY || !val) {
				return;
			}
			this.todos.push({
				id: util.uuid(),
				title: val,
				completed: false
			});

			$input.val('');

			this.render();
		},
		/*改变任务的状态*/
		toggle: function (e) {
			var i = this.getIndexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		/*双击后编辑任务*/
		editingMode: function (e) {
			/*用样式来控制div，你也是吊*/
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			$input.val($input.val()).focus();
		},
		/*任务处于编辑状态的时候，对键盘的检测*/
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		/*更新数组*/
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();
			/*如果输入的字符串为空，就销毁任务*/
			if (!val) {
				this.destroy(e);
				return;
			}
			/*目的是为了在按esc的时候,进行判断，如果是esc就不更新数组*/
			if ($el.data('abort')) {
				$el.data('abort', false);
			} else {
				this.todos[this.getIndexFromEl(el)].title = val;
			}

			this.render();
		},
		/*销毁任务*/
		destroy: function (e) {
			/*在数组里找到ID然后销毁*/
			this.todos.splice(this.getIndexFromEl(e.target), 1);
			/*然后刷新页面*/
			this.render();
		}
	};

	App.init();
});
